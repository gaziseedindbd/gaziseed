import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabase } from '@/lib/supabase/server';

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

    const [settingsRes, conversationsRes, handoffsRes, messagesRes, productOrdersRes, comboOrdersRes, offerOrdersRes] = await Promise.all([
      sb.from('ai_settings').select('id,is_enabled,provider,model,base_url,temperature,max_tokens,feature_flags,updated_at').eq('id', 1).maybeSingle(),
      sb.from('ai_conversations').select('id,channel,external_user_id,page_id,status,metadata,last_message_at,created_at,updated_at').order('updated_at', { ascending: false }).limit(12),
      sb.from('ai_handoffs').select('id,conversation_id,reason,status,assigned_to,notes,created_at,resolved_at').order('created_at', { ascending: false }).limit(12),
      sb.from('ai_messages').select('id,conversation_id,role,provider,model,tool_name,action_status,requires_confirmation,created_at').order('created_at', { ascending: false }).limit(20),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('order_source', 'facebook_messenger_ai'),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('order_source', 'facebook_messenger_ai_combo'),
      sb.from('orders').select('id', { count: 'exact', head: true }).eq('order_source', 'facebook_messenger_ai_offer'),
    ]);

    if (settingsRes.error) throw settingsRes.error;

    const flags = (settingsRes.data?.feature_flags && typeof settingsRes.data.feature_flags === 'object')
      ? settingsRes.data.feature_flags
      : {};

    const providers = [
      {
        key: 'groq',
        label: 'Groq',
        configured: Boolean(process.env.GROQ_API_KEY),
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        priority: 1,
      },
      {
        key: 'gemini',
        label: 'Gemini',
        configured: Boolean(process.env.GEMINI_API_KEY),
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
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
        recent_messages: messagesRes.data?.length || 0,
        product_orders: productOrdersRes.count || 0,
        combo_orders: comboOrdersRes.count || 0,
        offer_orders: offerOrdersRes.count || 0,
      },
      conversations: conversationsRes.data || [],
      handoffs: handoffsRes.data || [],
      messages: messagesRes.data || [],
    });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'AI Messenger admin request failed' }, { status: 500 });
  }
}
