import type { NormalizedWhatsAppMessage, WhatsAppConversationContext } from './types';
import { createWhatsAppSupabase } from './server';
import { getWhatsAppBranch, resolveWhatsAppCountry } from './branches';

function resolveCountry(message: NormalizedWhatsAppMessage): 'BD' | 'IN' {
  const fromMetadata = String(message.metadata?.countryCode || '').toUpperCase();
  if (fromMetadata === 'IN' || fromMetadata === 'BD') return fromMetadata;

  const businessNumber = String(message.metadata?.businessNumber || '');
  return resolveWhatsAppCountry(businessNumber) || 'BD';
}

export async function getOrCreateWhatsAppConversation(
  message: NormalizedWhatsAppMessage,
): Promise<WhatsAppConversationContext> {
  const country = resolveCountry(message);
  const supabase = createWhatsAppSupabase(country);

  const { data: existing, error: lookupError } = await supabase
    .from('ai_conversations')
    .select('id, channel, external_user_id, status, metadata')
    .eq('channel', 'whatsapp')
    .eq('external_user_id', message.externalUserId)
    .eq('country_code', country)
    .maybeSingle();

  if (lookupError) throw new Error(`WhatsApp conversation lookup failed: ${lookupError.message}`);

  if (existing) {
    return {
      id: existing.id,
      channel: 'whatsapp',
      externalUserId: existing.external_user_id,
      status: existing.status,
      metadata: (existing.metadata || {}) as Record<string, unknown>,
    };
  }

  const branch = getWhatsAppBranch(country);
  const { data: created, error: createError } = await supabase
    .from('ai_conversations')
    .insert({
      channel: 'whatsapp',
      external_user_id: message.externalUserId,
      metadata: {
        ...(message.metadata || {}),
        phone: message.phone || null,
        provider: message.provider || null,
        country_code: country,
        branch: branch.branch,
        currency: branch.currency,
      },
      last_message_at: new Date().toISOString(),
      country_code: country,
    })
    .select('id, channel, external_user_id, status, metadata')
    .single();

  if (createError || !created) {
    throw new Error(`WhatsApp conversation creation failed: ${createError?.message || 'unknown error'}`);
  }

  return {
    id: created.id,
    channel: 'whatsapp',
    externalUserId: created.external_user_id,
    status: created.status,
    metadata: (created.metadata || {}) as Record<string, unknown>,
  };
}

export async function recordWhatsAppUserMessage(
  conversationId: string,
  message: NormalizedWhatsAppMessage,
): Promise<boolean> {
  const country = resolveCountry(message);
  const supabase = createWhatsAppSupabase(country);

  if (message.externalMessageId) {
    const { data: duplicate, error: duplicateError } = await supabase
      .from('ai_messages')
      .select('id')
      .eq('external_message_id', message.externalMessageId)
      .maybeSingle();

    if (duplicateError) throw new Error(`WhatsApp message idempotency check failed: ${duplicateError.message}`);
    if (duplicate) return false;
  }

  const { error } = await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: message.text,
    external_message_id: message.externalMessageId || null,
    source_context: {
      channel: 'whatsapp',
      phone: message.phone || null,
      provider: message.provider || null,
      language: message.language || null,
      country_code: country,
    },
    country_code: country,
  });

  if (error) throw new Error(`WhatsApp message persistence failed: ${error.message}`);

  const { error: updateError } = await supabase
    .from('ai_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (updateError) throw new Error(`WhatsApp conversation update failed: ${updateError.message}`);
  return true;
}

function compactJson(value: unknown, max = 6000): string {
  const json = JSON.stringify(value);
  return json.length > max ? json.slice(0, max) + '…' : json;
}

export async function recordWhatsAppAssistantMessage(
  conversationId: string,
  country: 'BD' | 'IN',
  content: string,
  provider: string,
  model: string,
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result: unknown }>,
): Promise<void> {
  const supabase = createWhatsAppSupabase(country);

  for (const toolCall of toolCalls) {
    const { error: toolError } = await supabase.from('ai_messages').insert({
      conversation_id: conversationId,
      role: 'tool',
      content: compactJson(toolCall.result),
      provider,
      model,
      tool_name: toolCall.name,
      tool_args: toolCall.args,
      tool_result: toolCall.result,
      action_status: 'completed',
      country_code: country,
      source_context: { channel: 'whatsapp' },
    });

    if (toolError) throw new Error(`WhatsApp tool message persistence failed: ${toolError.message}`);
  }

  const { error: assistantError } = await supabase.from('ai_messages').insert({
    conversation_id: conversationId,
    role: 'assistant',
    content,
    provider,
    model,
    action_status: 'completed',
    requires_confirmation: false,
    source_context: {
      channel: 'whatsapp',
      tool_count: toolCalls.length,
      tool_names: toolCalls.map((tool) => tool.name),
    },
    country_code: country,
  });

  if (assistantError) throw new Error(`WhatsApp assistant message persistence failed: ${assistantError.message}`);

  const needsHuman = toolCalls.some((tool) => tool.name === 'request_human_support');
  if (needsHuman) {
    const { error: conversationError } = await supabase
      .from('ai_conversations')
      .update({ status: 'handoff', last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (conversationError) throw new Error(`WhatsApp handoff status update failed: ${conversationError.message}`);

    const supportTool = toolCalls.find((tool) => tool.name === 'request_human_support');
    const ticketId = supportTool && typeof supportTool.result === 'object' && supportTool.result !== null
      ? (supportTool.result as { data?: { ticket_id?: string } }).data?.ticket_id
      : undefined;

    const { error: handoffError } = await supabase.from('ai_handoffs').insert({
      conversation_id: conversationId,
      reason: ticketId ? `WhatsApp human-support ticket ${ticketId}` : 'WhatsApp AI requested human support',
      status: 'open',
      notes: 'Created by WhatsApp AI support flow.',
      country_code: country,
    });

    if (handoffError) throw new Error(`WhatsApp handoff creation failed: ${handoffError.message}`);
  } else {
    const { error: updateError } = await supabase
      .from('ai_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);

    if (updateError) throw new Error(`WhatsApp assistant conversation update failed: ${updateError.message}`);
  }
}
