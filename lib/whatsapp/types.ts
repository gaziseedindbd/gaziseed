export type WhatsAppLanguage = 'bn' | 'en' | 'hi';

export interface NormalizedWhatsAppMessage {
  channel: 'whatsapp';
  externalUserId: string;
  externalMessageId?: string | null;
  phone?: string | null;
  text: string;
  language?: WhatsAppLanguage | null;
  provider?: string | null;
  metadata?: Record<string, unknown>;
}

export interface WhatsAppConversationContext {
  id: string;
  channel: 'whatsapp';
  externalUserId: string;
  status: 'active' | 'handoff' | 'closed';
  metadata: Record<string, unknown>;
}
