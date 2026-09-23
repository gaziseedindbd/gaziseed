import type { NormalizedWhatsAppMessage, WhatsAppConversationContext } from './types';
import { createWhatsAppSupabase } from './server';

export async function getOrCreateWhatsAppConversation(
  message: NormalizedWhatsAppMessage,
): Promise<WhatsAppConversationContext> {
  const supabase = createWhatsAppSupabase();

  const { data: existing, error: lookupError } = await supabase
    .from('ai_conversations')
    .select('id, channel, external_user_id, status, metadata')
    .eq('channel', 'whatsapp')
    .eq('external_user_id', message.externalUserId)
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

  const { data: created, error: createError } = await supabase
    .from('ai_conversations')
    .insert({
      channel: 'whatsapp',
      external_user_id: message.externalUserId,
      metadata: {
        ...(message.metadata || {}),
        phone: message.phone || null,
        provider: message.provider || null,
      },
      last_message_at: new Date().toISOString(),
      country_code: 'BD',
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
): Promise<void> {
  const supabase = createWhatsAppSupabase();

  if (message.externalMessageId) {
    const { data: duplicate, error: duplicateError } = await supabase
      .from('ai_messages')
      .select('id')
      .eq('external_message_id', message.externalMessageId)
      .maybeSingle();

    if (duplicateError) throw new Error(`WhatsApp message idempotency check failed: ${duplicateError.message}`);
    if (duplicate) return;
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
    },
    country_code: 'BD',
  });

  if (error) throw new Error(`WhatsApp message persistence failed: ${error.message}`);

  const { error: updateError } = await supabase
    .from('ai_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (updateError) throw new Error(`WhatsApp conversation update failed: ${updateError.message}`);
}
