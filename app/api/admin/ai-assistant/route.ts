import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { buildMessengerMonitoringSummary } from '@/lib/ai/messenger-monitoring';
import { getMessengerHumanSupportQueueState } from '@/lib/ai/messenger-human-support';

export const dynamic = 'force-dynamic';

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  try {
    const authClient = await createServerSupabase();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });

    const { data: isAdmin } = await authClient.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });

    const sb = adminSupabase();
    if (!sb) return NextResponse.json({ success: false, message: 'Server configuration incomplete' }, { status: 500 });

    const monitoringSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [settingsRes, conversationsRes, handoffsRes, messagesRes, monitoringMessagesRes, productOrdersRes, comboOrdersRes, offerOrdersRes] = await Promise.all([
      sb.from('ai_settings').select('id,is_enabled,provider,model,base_url,temperature,max_tokens,feature_flags,updated_at').eq('id', 1).maybeSingle(),
      sb.from('ai_conversations').select('id,channel,external_user_id,page_id,status,metadata,last_message_at,created_at,updated_at').order('updated_at', { ascending: false }).limit(12),
      sb.from('ai_handoffs').select('id,conversation_id,reason,status,assigned_to,notes,created_at,resolved_at,country_code').order('created_at', { ascending: false }).limit(50),
      sb.from('ai_messages').select('id,conversation_id,role,provider,model,tool_name,action_status,requires_confirmation,created_at').order('created_at', { ascending: false }).limit(20),
      sb.from('ai_messages').select('role,provider,action_status,source_context').gte('created_at', monitoringSince).order('created_at', { ascending: false }).limit(2000),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('order_source', 'facebook_messenger_ai'),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('order_source', 'facebook_messenger_ai_combo'),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('order_source', 'facebook_messenger_ai_offer'),
    ]);

    if (settingsRes.error) throw settingsRes.error;
    if (monitoringMessagesRes.error) throw monitoringMessagesRes.error;

    const monitoring = buildMessengerMonitoringSummary(
      (monitoringMessagesRes.data || []).map((message) => ({
        role: message.role,
        provider: message.provider,
        action_status: message.action_status,
        source_context: message.source_context,
      })),
    );

    const allConversations = conversationsRes.data || [];
    const allHandoffs = handoffsRes.data || [];

    const bdSupportHandoffs = allHandoffs.filter(
      (handoff) =>
        handoff.country_code === 'BD' &&
        handoff.reason === 'customer_requested_human_support',
    );

    const supportConversationIds = Array.from(
      new Set(bdSupportHandoffs.map((handoff) => handoff.conversation_id)),
    );

    let supportMessages: Array<{
      id: string;
      conversation_id: string;
      role: string;
      content: string | null;
      created_at: string;
      action_status: string | null;
    }> = [];

    if (supportConversationIds.length) {
      const contextRes = await sb
        .from('ai_messages')
        .select('id,conversation_id,role,content,created_at,action_status')
        .in('conversation_id', supportConversationIds)
        .order('created_at', { ascending: false })
        .limit(Math.min(1200, supportConversationIds.length * 50));

      if (contextRes.error) throw contextRes.error;
      supportMessages = contextRes.data || [];
    }

    const supportExternalUserIds = Array.from(
      new Set(
        allConversations
          .filter((conversation) => supportConversationIds.includes(conversation.id))
          .map((conversation) => conversation.external_user_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let supportProfiles: Array<Record<string, unknown>> = [];
    if (supportExternalUserIds.length) {
      const profilesRes = await sb
        .from('messenger_customer_profiles')
        .select('id,page_id,external_user_id,country_code,name,phone,address,total_orders,total_spent,last_order_number,order_numbers,updated_at')
        .eq('country_code', 'BD')
        .eq('page_id', process.env.META_PAGE_ID || '')
        .in('external_user_id', supportExternalUserIds);

      if (profilesRes.error) throw profilesRes.error;
      supportProfiles = (profilesRes.data || []) as Array<Record<string, unknown>>;
    }

    const conversationMap = new Map(
      allConversations.map((conversation) => [conversation.id, conversation]),
    );
    const profileMap = new Map(
      supportProfiles.map((profile) => [
        String(profile.external_user_id),
        profile,
      ]),
    );
    const messagesByConversation = new Map<string, typeof supportMessages>();

    for (const message of supportMessages) {
      const current = messagesByConversation.get(message.conversation_id) || [];
      current.push(message);
      messagesByConversation.set(message.conversation_id, current);
    }

    const supportQueue = bdSupportHandoffs.map((handoff) => {
      const conversation = conversationMap.get(handoff.conversation_id);
      const externalUserId = conversation?.external_user_id || null;
      const context = (messagesByConversation.get(handoff.conversation_id) || [])
        .slice(0, 30)
        .reverse();

      return {
        ...handoff,
        queue_state: getMessengerHumanSupportQueueState(handoff.status),
        conversation: conversation
          ? {
              id: conversation.id,
              external_user_id: conversation.external_user_id,
              page_id: conversation.page_id,
              status: conversation.status,
              country_code: conversation.country_code,
              metadata: conversation.metadata,
              last_message_at: conversation.last_message_at,
              updated_at: conversation.updated_at,
            }
          : null,
        customer_profile: externalUserId
          ? profileMap.get(externalUserId) || null
          : null,
        context,
      };
    });

    const flags = (settingsRes.data?.feature_flags && typeof settingsRes.data.feature_flags === 'object')
      ? settingsRes.data.feature_flags
      : {};

    const providers = [
      {
        key: 'gemini',
        label: 'Gemini',
        configured: Boolean(process.env.GEMINI_API_KEY),
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        priority: 1,
      },
      {
        key: 'groq',
        label: 'Groq',
        configured: Boolean(process.env.GROQ_API_KEY),
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        priority: 2,
      },
      {
        key: 'cerebras',
        label: 'Cerebras',
        configured: Boolean(process.env.CEREBRAS_API_KEY),
        model: process.env.CEREBRAS_MODEL || 'llama-3.3-70b',
        priority: 3,
      },
      {
        key: 'openrouter',
        label: 'OpenRouter',
        configured: Boolean(process.env.OPENROUTER_API_KEY),
        model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct',
        priority: 4,
      },
    ];

    const openSupportQueueCount = supportQueue.filter(
      (handoff) => handoff.queue_state !== 'closed',
    ).length;

    return NextResponse.json({
      success: true,
      messenger: {
        enabled: process.env.AI_MESSENGER_ENABLED === 'true',
        meta_configured: Boolean(process.env.META_VERIFY_TOKEN && process.env.META_APP_SECRET && process.env.META_PAGE_ACCESS_TOKEN),
        webhook_signature_required: true,
      },
      settings: settingsRes.data
        ? {
            is_enabled: Boolean(settingsRes.data.is_enabled),
            provider: settingsRes.data.provider || null,
            model: settingsRes.data.model || null,
            base_url: settingsRes.data.base_url || null,
            temperature: settingsRes.data.temperature ?? null,
            max_tokens: settingsRes.data.max_tokens ?? null,
            feature_flags: flags,
            updated_at: settingsRes.data.updated_at || null,
          }
        : null,
      providers,
      stats: {
        conversations: conversationsRes.data?.length || 0,
        open_handoffs: (handoffsRes.data || []).filter((h) => ['open', 'assigned'].includes(h.status)).length,
        bd_human_support_queue: openSupportQueueCount,
        recent_messages: messagesRes.data?.length || 0,
        product_orders: productOrdersRes.count || 0,
        combo_orders: comboOrdersRes.count || 0,
        offer_orders: offerOrdersRes.count || 0,
      },
      monitoring: {
        window_hours: 24,
        ...monitoring,
      },
      conversations: conversationsRes.data || [],
      handoffs: allHandoffs || [],
      support_queue: supportQueue,
      messages: messagesRes.data || [],
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'AI Messenger admin request failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authClient = await createServerSupabase();
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });

    const { data: isAdmin } = await authClient.rpc('is_admin');
    if (!isAdmin) return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });

    const body = (await request.json()) as {
      action?: 'claim' | 'close' | 'reopen';
      handoff_id?: string;
    };

    if (!body.handoff_id || !body.action) {
      return NextResponse.json({ success: false, message: 'handoff_id and action are required' }, { status: 400 });
    }

    const sb = adminSupabase();
    if (!sb) return NextResponse.json({ success: false, message: 'Server configuration incomplete' }, { status: 500 });

    const { data: handoff, error: handoffError } = await sb
      .from('ai_handoffs')
      .select('id,conversation_id,reason,status,assigned_to,notes,country_code')
      .eq('id', body.handoff_id)
      .maybeSingle();

    if (handoffError) throw handoffError;
    if (!handoff) return NextResponse.json({ success: false, message: 'Handoff not found' }, { status: 404 });

    if (handoff.country_code !== 'BD' || handoff.reason !== 'customer_requested_human_support') {
      return NextResponse.json({ success: false, message: 'This action is only available for Bangladesh human-support handoffs' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (body.action === 'claim') {
      const { error } = await sb
        .from('ai_handoffs')
        .update({
          status: 'assigned',
          assigned_to: user.id,
          notes: 'Human support agent claimed this Bangladesh Messenger conversation.',
        })
        .eq('id', handoff.id);

      if (error) throw error;

      const { data: conversation } = await sb
        .from('ai_conversations')
        .select('metadata')
        .eq('id', handoff.conversation_id)
        .maybeSingle();

      const metadata = {
        ...(conversation?.metadata || {}),
        human_takeover: true,
        human_support_state: 'open',
        human_support_assigned_to: user.id,
        human_support_claimed_at: now,
      };

      await sb
        .from('ai_conversations')
        .update({
          status: 'handoff',
          metadata,
          updated_at: now,
        })
        .eq('id', handoff.conversation_id);

      return NextResponse.json({ success: true, action: 'claim', queue_state: 'open' });
    }

    if (body.action === 'reopen') {
      const { error } = await sb
        .from('ai_handoffs')
        .update({
          status: 'open',
          assigned_to: null,
          resolved_at: null,
          notes: 'Bangladesh human-support handoff reopened and returned to the pending queue.',
        })
        .eq('id', handoff.id);

      if (error) throw error;

      const { data: conversation } = await sb
        .from('ai_conversations')
        .select('metadata')
        .eq('id', handoff.conversation_id)
        .maybeSingle();

      const metadata = {
        ...(conversation?.metadata || {}),
        human_takeover: true,
        human_support_state: 'pending',
        human_support_assigned_to: null,
        human_support_reopened_at: now,
      };

      await sb
        .from('ai_conversations')
        .update({
          status: 'handoff',
          metadata,
          updated_at: now,
        })
        .eq('id', handoff.conversation_id);

      return NextResponse.json({ success: true, action: 'reopen', queue_state: 'pending' });
    }

    const { error: closeError } = await sb
      .from('ai_handoffs')
      .update({
        status: 'resolved',
        resolved_at: now,
        notes: 'Bangladesh human-support handoff closed by admin.',
      })
      .eq('id', handoff.id);

    if (closeError) throw closeError;

    const { data: conversation } = await sb
      .from('ai_conversations')
      .select('metadata')
      .eq('id', handoff.conversation_id)
      .maybeSingle();

    const metadata = {
      ...(conversation?.metadata || {}),
      human_takeover: false,
      human_support_state: 'closed',
      human_support_resolved_at: now,
      human_support_assigned_to: null,
    };

    const { error: conversationError } = await sb
      .from('ai_conversations')
      .update({
        status: 'active',
        metadata,
        updated_at: now,
      })
      .eq('id', handoff.conversation_id);

    if (conversationError) throw conversationError;

    return NextResponse.json({ success: true, action: 'close', queue_state: 'closed' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'AI Messenger handoff action failed' }, { status: 500 });
  }
}
