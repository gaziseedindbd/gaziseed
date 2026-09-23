import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateWhatsAppConversation, recordWhatsAppUserMessage } from '@/lib/whatsapp/conversations';
import { resolveWhatsAppCountry } from '@/lib/whatsapp/branches';
import type { NormalizedWhatsAppMessage } from '@/lib/whatsapp/types';

export const runtime = 'nodejs';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function getWebhookSecret(req: NextRequest): string {
  return req.headers.get('x-whatsapp-webhook-secret') || '';
}

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ success: false, message: 'WhatsApp webhook is not configured' }, { status: 503 });
    }

    const providedSecret = getWebhookSecret(req);
    if (!providedSecret || !constantTimeEqual(providedSecret, expectedSecret)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json()) as Partial<NormalizedWhatsAppMessage>;

    if (body.channel !== 'whatsapp' || !body.externalUserId || !body.text?.trim()) {
      return NextResponse.json({ success: false, message: 'Invalid normalized WhatsApp payload' }, { status: 400 });
    }

    const businessNumber = String(body.metadata?.businessNumber || '');
    const country = String(body.metadata?.countryCode || '').toUpperCase();

    if (country !== 'BD' && country !== 'IN') {
      return NextResponse.json({ success: false, message: 'WhatsApp branch country is required' }, { status: 400 });
    }

    const resolvedCountry = resolveWhatsAppCountry(businessNumber);
    if (businessNumber && resolvedCountry && resolvedCountry !== country) {
      return NextResponse.json({ success: false, message: 'WhatsApp business number does not match country' }, { status: 400 });
    }

    const message: NormalizedWhatsAppMessage = {
      channel: 'whatsapp',
      externalUserId: body.externalUserId,
      externalMessageId: body.externalMessageId || null,
      phone: body.phone || null,
      text: body.text.trim(),
      language: body.language || null,
      provider: body.provider || 'unknown',
      metadata: {
        ...(body.metadata || {}),
        countryCode: country,
      },
    };

    const conversation = await getOrCreateWhatsAppConversation(message);
    await recordWhatsAppUserMessage(conversation.id, message);

    return NextResponse.json({
      success: true,
      conversation_id: conversation.id,
      country_code: country,
      accepted: true,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'WhatsApp webhook failed' },
      { status: 500 },
    );
  }
}
