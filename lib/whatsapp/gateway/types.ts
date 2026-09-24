import type { NormalizedWhatsAppMessage } from '@/lib/whatsapp/types';

export type WhatsAppGatewayProvider = 'mock' | 'custom';

export interface WhatsAppSendInput {
  to: string;
  text: string;
  country: 'BD' | 'IN';
  businessNumber?: string | null;
  conversationId?: string | null;
}

export interface WhatsAppGateway {
  provider: WhatsAppGatewayProvider;
  normalizeInbound(payload: unknown): NormalizedWhatsAppMessage;
  sendText(input: WhatsAppSendInput): Promise<{ ok: boolean; provider: string; messageId?: string; error?: string }>;
}
