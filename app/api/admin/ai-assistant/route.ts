import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { buildMessengerMonitoringSummary } from '@/lib/ai/messenger-monitoring';

export const dynamic = 'force-dynamic';

function adminSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET(request: Request) {
  try {
    const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
    if (!accessToken) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const sb = adminSupabase();
    if (!sb) return NextResponse.json({ success: false, message: 'Server configuration incomplete' }, { status: 500 });

    const { data: { user }, error: userError } = await sb.auth.getUser(accessToken);
    if (userError || !user) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { data: adminRow, error: adminError } = await sb
      .from('admin_users')
      .select('user_id,role,country_code')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!adminRow) {
      return NextResponse.json({ success: false, message: 'Admin access required' }, { status: 403 });
    }
    let resolvedCountry = String(adminRow.country_code || '').toUpperCase();

    if (adminRow.role === 'master_admin') {
      const { data: branchContext, error: branchContextError } = await sb
        .from('admin_branch_context')
        .select('country_code')
        .eq('user_id', user.id)
        .maybeSingle();

      if (branchContextError) throw branchContextError;
      resolvedCountry = String(branchContext?.country_code || '').toUpperCase();
    }

    if (!['IN', 'BD'].includes(resolvedCountry)) {
      return NextResponse.json({success: false, message: 'Unable to verify admin branch'}, {status: 403});
    }
    const adminCountry = resolvedCountry as 'IN' | 'BD';

    const monitoringSince = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [settingsRes, conversationsRes, handoffsRes, messagesRes, monitoringMessagesRes, productOrdersRes, comboOrdersRes, offerOrdersRes] = await Promise.all([
      sb.from('ai_settings').select('id,is_enabled,provider,model,base_url,temperature,max_tokens,feature_flags,updated_at,country_code').eq('id', 1).eq('country_code', adminCountry).maybeSingle(),
      sb.from('ai_conversations').select('id,channel,external_user_id,page_id,status,metadata,last_message_at,created_at,updated_at').eq('country_code', adminCountry).order('updated_at', { ascending: false }).limit(12),
      sb.from('ai_handoffs').select('id,conversation_id,reason,status,assigned_to,notes,created_at,resolved_at').eq('country_code', adminCountry).order('created_at', { ascending: false }).limit(12),
      sb.from('ai_messages').select('id,conversation_id,role,provider,model,tool_name,action_status,requires_confirmation,created_at').eq('country_code', adminCountry).order('created_at', { ascending: false }).limit(20),
      sb.from('ai_messages').select('conversation_id,role,provider,action_status,source_context').eq('country_code', adminCountry).gte('created_at', monitoringSince).order('created_at', { ascending: false }).limit(2000),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('country_code', adminCountry).eq('order_source', 'facebook_messenger_ai'),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('country_code', adminCountry).eq('order_source', 'facebook_messenger_ai_combo'),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('country_code', adminCountry).eq('order_source', 'facebook_messenger_ai_offer'),
    ]);

    for (const result of [settingsRes, conversationsRes, handoffsRes, messagesRes,
      monitoringMessagesRes, productOrdersRes, comboOrdersRes, offerOrdersRes]) {
      if (result.error) throw result.error;
    }
    // Legacy rows may have a branch that disagrees with their conversation.
    // Both row and parent must belong to the selected branch.
    const parentIds = Array.from(new Set([
      ...(handoffsRes.data || []).map(row => row.conversation_id),
      ...(messagesRes.data || []).map(row => row.conversation_id),
      ...(monitoringMessagesRes.data || []).map(row => row.conversation_id),
    ].filter(Boolean)));
    const permittedParents = new Set<string>();
    for (let index = 0; index < parentIds.length; index += 100) {
      const {data: parents, error: parentError} = await sb.from('ai_conversations')
        .select('id').eq('country_code', adminCountry).in('id', parentIds.slice(index, index + 100));
      if (parentError) throw parentError;
      for (const parent of parents || []) permittedParents.add(parent.id);
    }
    const safeHandoffs = (handoffsRes.data || []).filter(row => permittedParents.has(row.conversation_id));
    const safeMessages = (messagesRes.data || []).filter(row => permittedParents.has(row.conversation_id));
    const safeMonitoring = (monitoringMessagesRes.data || []).filter(row => permittedParents.has(row.conversation_id));
    const monitoring = buildMessengerMonitoringSummary(
      safeMonitoring.map((message) => ({
        role: message.role,
        provider: message.provider,
        action_status: message.action_status,
        source_context: message.source_context,
      })),
    );


    const flags = (settingsRes.data?.feature_flags && typeof settingsRes.data.feature_flags === 'object')
      ? settingsRes.data.feature_flags
      : {};

    const providers = [
      {
        key: 'gemini',
        label: 'Gemini',
        configured:
          Boolean(process.env.GEMINI_API_KEY) &&
          process.env.GEMINI_MESSENGER_ENABLED === 'true',
        key_present: Boolean(process.env.GEMINI_API_KEY),
        model: process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        priority: 1,
      },
      {
        key: 'groq',
        label: 'Groq',
        configured: Boolean(process.env.GROQ_API_KEY),
        key_present: Boolean(process.env.GROQ_API_KEY),
        model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
        priority: 2,
      },
      {
        key: 'cerebras',
        label: 'Cerebras',
        configured: Boolean(process.env.CEREBRAS_API_KEY),
        key_present: Boolean(process.env.CEREBRAS_API_KEY),
        model: process.env.CEREBRAS_MODEL || 'qwen-3.8-27b',
        priority: 3,
      },
      {
        key: 'openrouter',
        label: 'OpenRouter',
        configured: Boolean(process.env.OPENROUTER_API_KEY),
        key_present: Boolean(process.env.OPENROUTER_API_KEY),
        model:
          process.env.OPENROUTER_MODEL ||
          'nvidia/nemotron-3-ultra-550b-a55b:free',
        priority: 4,
      },
    ];

    return NextResponse.json({
      success: true,
      country_code: adminCountry,
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
        open_handoffs: safeHandoffs.filter((h) => ['open', 'assigned'].includes(h.status)).length,
        recent_messages: safeMessages.length,
        product_orders: productOrdersRes.count || 0,
        combo_orders: comboOrdersRes.count || 0,
        offer_orders: offerOrdersRes.count || 0,
      },
      monitoring: {
        window_hours: 24,
        ...monitoring,
      },
      conversations: conversationsRes.data || [],
      handoffs: safeHandoffs,
      messages: safeMessages,
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'AI Messenger admin request failed' }, { status: 500 });
  }
}
