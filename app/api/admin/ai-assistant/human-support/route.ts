import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
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

async function requireAdmin(request: Request) {
  const accessToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim() || '';
  if (!accessToken) {
    return { ok: false as const, status: 401, message: 'Authentication required', user: null };
  }

  const sb = adminSupabase();
  if (!sb) {
    return { ok: false as const, status: 500, message: 'Server configuration incomplete', user: null };
  }

  const { data: { user }, error: userError } = await sb.auth.getUser(accessToken);
  if (userError || !user) {
    return { ok: false as const, status: 401, message: 'Authentication required', user: null };
  }

  const { data: adminRow, error: adminError } = await sb
    .from('admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle();

  if (adminError) throw adminError;
  if (!adminRow) {
    return { ok: false as const, status: 403, message: 'Admin access required', user: null };
  }

  return { ok: true as const, status: 200, message: '', user };
}

export async function GET(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const sb = adminSupabase();
    if (!sb) {
      return NextResponse.json(
        { success: false, message: 'Server configuration incomplete' },
        { status: 500 },
      );
    }

    const { data: handoffs, error: handoffError } = await sb
      .from('ai_handoffs')
      .select(
        'id,conversation_id,reason,status,assigned_to,notes,created_at,resolved_at,country_code',
      )
      .eq('country_code', 'BD')
      .eq('reason', 'customer_requested_human_support')
      .order('created_at', { ascending: false })
      .limit(50);

    if (handoffError) throw handoffError;

    const rows = handoffs || [];
    const conversationIds = Array.from(
      new Set(rows.map((handoff) => handoff.conversation_id)),
    );

    const conversations =
      conversationIds.length > 0
        ? (
            await sb
              .from('ai_conversations')
              .select(
                'id,external_user_id,page_id,status,country_code,metadata,last_message_at,updated_at',
              )
              .in('id', conversationIds)
          ).data || []
        : [];

    const externalUserIds = Array.from(
      new Set(
        conversations
          .map((conversation) => conversation.external_user_id)
          .filter((value): value is string => Boolean(value)),
      ),
    );

    const messages =
      conversationIds.length > 0
        ? (
            await sb
              .from('ai_messages')
              .select('id,conversation_id,role,content,created_at,action_status')
              .in('conversation_id', conversationIds)
              .order('created_at', { ascending: false })
              .limit(Math.min(1500, conversationIds.length * 50))
          ).data || []
        : [];

    const profiles =
      externalUserIds.length > 0
        ? (
            await sb
              .from('messenger_customer_profiles')
              .select(
                'id,page_id,external_user_id,country_code,name,phone,address,total_orders,total_spent,last_order_number,order_numbers,updated_at',
              )
              .eq('country_code', 'BD')
              .eq('page_id', process.env.META_PAGE_ID || '')
              .in('external_user_id', externalUserIds)
          ).data || []
        : [];

    const conversationMap = new Map(
      conversations.map((conversation) => [conversation.id, conversation]),
    );
    const profileMap = new Map(
      profiles.map((profile) => [String(profile.external_user_id), profile]),
    );
    const messagesByConversation = new Map<string, typeof messages>();

    for (const message of messages) {
      const list = messagesByConversation.get(message.conversation_id) || [];
      list.push(message);
      messagesByConversation.set(message.conversation_id, list);
    }

    const supportQueue = rows.map((handoff) => {
      const conversation = conversationMap.get(handoff.conversation_id);
      const externalUserId = conversation?.external_user_id || null;

      return {
        ...handoff,
        queue_state: getMessengerHumanSupportQueueState(handoff.status),
        conversation: conversation || null,
        customer_profile: externalUserId
          ? profileMap.get(externalUserId) || null
          : null,
        context: (messagesByConversation.get(handoff.conversation_id) || [])
          .slice(0, 30)
          .reverse(),
      };
    });

    return NextResponse.json({
      success: true,
      active_count: supportQueue.filter((handoff) => handoff.queue_state !== 'closed').length,
      support_queue: supportQueue,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Bangladesh human-support queue request failed',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) {
      return NextResponse.json({ success: false, message: auth.message }, { status: auth.status });
    }

    const body = (await request.json()) as {
      action?: 'claim' | 'close' | 'reopen';
      handoff_id?: string;
    };

    if (!body.action || !body.handoff_id) {
      return NextResponse.json(
        { success: false, message: 'handoff_id and action are required' },
        { status: 400 },
      );
    }

    const sb = adminSupabase();
    if (!sb) {
      return NextResponse.json(
        { success: false, message: 'Server configuration incomplete' },
        { status: 500 },
      );
    }

    const { data: handoff, error: handoffError } = await sb
      .from('ai_handoffs')
      .select('id,conversation_id,reason,status,assigned_to,notes,country_code')
      .eq('id', body.handoff_id)
      .maybeSingle();

    if (handoffError) throw handoffError;
    if (
      !handoff ||
      handoff.country_code !== 'BD' ||
      handoff.reason !== 'customer_requested_human_support'
    ) {
      return NextResponse.json(
        { success: false, message: 'Bangladesh human-support handoff not found' },
        { status: 404 },
      );
    }

    const now = new Date().toISOString();

    const { data: conversation, error: conversationReadError } = await sb
      .from('ai_conversations')
      .select('metadata')
      .eq('id', handoff.conversation_id)
      .maybeSingle();

    if (conversationReadError) throw conversationReadError;

    if (body.action === 'claim') {
      const { error } = await sb
        .from('ai_handoffs')
        .update({
          status: 'assigned',
          assigned_to: auth.user.id,
          notes: 'Human support agent claimed this Bangladesh Messenger conversation.',
        })
        .eq('id', handoff.id);

      if (error) throw error;

      const metadata = {
        ...(conversation?.metadata || {}),
        human_takeover: true,
        human_support_state: 'open',
        human_support_assigned_to: auth.user.id,
        human_support_claimed_at: now,
      };

      const { error: conversationError } = await sb
        .from('ai_conversations')
        .update({
          status: 'handoff',
          metadata,
          updated_at: now,
        })
        .eq('id', handoff.conversation_id);

      if (conversationError) throw conversationError;

      return NextResponse.json({
        success: true,
        action: 'claim',
        queue_state: 'open',
      });
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

      const metadata = {
        ...(conversation?.metadata || {}),
        human_takeover: true,
        human_support_state: 'pending',
        human_support_assigned_to: null,
        human_support_reopened_at: now,
      };

      const { error: conversationError } = await sb
        .from('ai_conversations')
        .update({
          status: 'handoff',
          metadata,
          updated_at: now,
        })
        .eq('id', handoff.conversation_id);

      if (conversationError) throw conversationError;

      return NextResponse.json({
        success: true,
        action: 'reopen',
        queue_state: 'pending',
      });
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

    return NextResponse.json({
      success: true,
      action: 'close',
      queue_state: 'closed',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Bangladesh human-support action failed',
      },
      { status: 500 },
    );
  }
}
