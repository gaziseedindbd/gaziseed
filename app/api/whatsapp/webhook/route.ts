import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateWhatsAppConversation, recordWhatsAppAssistantMessage, recordWhatsAppUserMessage } from '@/lib/whatsapp/conversations';
import { getWhatsAppAISettings, isWhatsAppAIEnvironmentEnabled } from '@/lib/whatsapp/ai-settings';
import { runWhatsAppAgent } from '@/lib/whatsapp/agent';
import { resolveWhatsAppCountry } from '@/lib/whatsapp/branches';
import { getWhatsAppGateway, isWhatsAppGatewayEnabled } from '@/lib/whatsapp/gateway';
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
    const text = body.text?.trim() || '';

    if (body.channel !== 'whatsapp' || !body.externalUserId || !text) {
      return NextResponse.json({ success: false, message: 'Invalid normalized WhatsApp payload' }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ success: false, message: 'WhatsApp message is too long' }, { status: 413 });
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
      text,
      language: body.language || null,
      provider: body.provider || 'unknown',
      metadata: { ...(body.metadata || {}), countryCode: country },
    };

    const conversation = await getOrCreateWhatsAppConversation(message);
    const accepted = await recordWhatsAppUserMessage(conversation.id, message);
    if (!accepted) {
      return NextResponse.json({
        success: true,
        conversation_id: conversation.id,
        country_code: country,
        accepted: true,
        duplicate: true,
      });
    }

    if (!isWhatsAppAIEnvironmentEnabled()) {
      return NextResponse.json({
        success: true,
        conversation_id: conversation.id,
        country_code: country,
        accepted: true,
        ai_enabled: false,
        response: null,
        reason: 'environment_kill_switch',
      });
    }

    let aiSettings;
    try {
      aiSettings = await getWhatsAppAISettings();
    } catch (settingsError) {
      const settingsMessage = settingsError instanceof Error ? settingsError.message : 'AI settings unavailable';
      if (settingsMessage.includes('Customer Support AI is disabled')) {
        return NextResponse.json({
          success: true,
          conversation_id: conversation.id,
          country_code: country,
          accepted: true,
          ai_enabled: false,
          response: null,
          reason: 'customer_support_ai_disabled',
        });
      }
      return NextResponse.json({
        success: false,
        conversation_id: conversation.id,
        country_code: country,
        accepted: true,
        ai_enabled: false,
        message: 'WhatsApp AI configuration is unavailable',
      }, { status: 503 });
    }

    if (!aiSettings.is_enabled) {
      return NextResponse.json({
        success: true,
        conversation_id: conversation.id,
        country_code: country,
        accepted: true,
        ai_enabled: false,
        response: null,
      });
    }

    let agent;
    try {
      agent = await runWhatsAppAgent({
        text: message.text,
        country: country as 'BD' | 'IN',
        customerPhone: message.phone || message.externalUserId,
        customerName: typeof message.metadata?.customerName === 'string' ? message.metadata.customerName : null,
        aiSettings,
      });
    } catch (agentError) {
      console.error('WhatsApp AI agent failed', agentError);
      return NextResponse.json({
        success: false,
        conversation_id: conversation.id,
        country_code: country,
        accepted: true,
        ai_enabled: true,
        message: 'WhatsApp AI response could not be generated',
      }, { status: 503 });
    }

    await recordWhatsAppAssistantMessage(
      conversation.id,
      country as 'BD' | 'IN',
      agent.content,
      aiSettings.provider,
      agent.model,
      agent.toolCalls,
    );

    let outbound: { ok: boolean; provider?: string; messageId?: string; error?: string } | null = null;
    if (isWhatsAppGatewayEnabled() && message.phone) {
      try {
        const gateway = getWhatsAppGateway();
        outbound = await gateway.sendText({
          to: message.phone,
          text: agent.content,
          country: country as 'BD' | 'IN',
          businessNumber,
          conversationId: conversation.id,
        });
      } catch (gatewayError) {
        console.error('WhatsApp outbound gateway failed', gatewayError);
        outbound = {
          ok: false,
          provider: process.env.WHATSAPP_GATEWAY_PROVIDER || 'unknown',
          error: 'Outbound gateway unavailable',
        };
      }
    }

    return NextResponse.json({
      success: true,
      conversation_id: conversation.id,
      country_code: country,
      accepted: true,
      response: agent.content,
      model: agent.model,
      tool_calls: agent.toolCalls.map((tool) => ({ name: tool.name, args: tool.args })),
      outbound,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : 'WhatsApp webhook failed' },
      { status: 500 },
    );
  }
}
