import type { NormalizedWhatsAppMessage } from '@/lib/whatsapp/types';
import type { WhatsAppGateway, WhatsAppSendInput } from './types';

function requiredString(value: unknown, field: string): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result) throw new Error(`Mock WhatsApp payload field "${field}" is required`);
  return result;
}

export const mockWhatsAppGateway: WhatsAppGateway = {
  provider: 'mock',

  normalizeInbound(payload: unknown): NormalizedWhatsAppMessage {
    if (!payload || typeof payload !== 'object') {
      throw new Error('Invalid mock WhatsApp payload');
    }

    const body = payload as Record<string, unknown>;
    const metadata = body.metadata && typeof body.metadata === 'object'
      ? body.metadata as Record<string, unknown>
      : {};

    const countryCode = String(metadata.countryCode || '').toUpperCase();
    if (countryCode !== 'BD' && countryCode !== 'IN') {
      throw new Error('Mock WhatsApp payload requires metadata.countryCode as BD or IN');
    }

    return {
      channel: 'whatsapp',
      externalUserId: requiredString(body.externalUserId, 'externalUserId'),
      externalMessageId: typeof body.externalMessageId === 'string' ? body.externalMessageId : null,
      phone: typeof body.phone === 'string' ? body.phone : null,
      text: requiredString(body.text, 'text'),
      language: body.language === 'bn' || body.language === 'en' || body.language === 'hi' ? body.language : null,
      provider: 'mock',
      metadata: { ...metadata, countryCode },
    };
  },

  async sendText(input: WhatsAppSendInput) {
    if (!input.to.trim() || !input.text.trim()) {
      return { ok: false, provider: 'mock', error: 'Recipient and text are required' };
    }

    return {
      ok: true,
      provider: 'mock',
      messageId: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    };
  },
};
