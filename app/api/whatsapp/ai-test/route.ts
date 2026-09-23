import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppAISettings, isWhatsAppAIEnvironmentEnabled } from '@/lib/whatsapp/ai-settings';
import { runWhatsAppAgent } from '@/lib/whatsapp/agent';

export const runtime = 'nodejs';

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function POST(req: NextRequest) {
  try {
    const expectedSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    const providedSecret = req.headers.get('x-whatsapp-webhook-secret') || '';

    if (!expectedSecret) {
      return NextResponse.json(
        { success: false, message: 'WhatsApp AI test endpoint is not configured' },
        { status: 503 },
      );
    }

    if (!providedSecret || !constantTimeEqual(providedSecret, expectedSecret)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    if (!isWhatsAppAIEnvironmentEnabled()) {
      return NextResponse.json({
        success: true,
        ai_enabled: false,
        reason: 'environment_kill_switch',
        message: 'WhatsApp AI is safely disabled. Enable WHATSAPP_AI_ENABLED only for an intentional internal AI test.',
      });
    }

    const body = (await req.json()) as {
      text?: unknown;
      country?: unknown;
      phone?: unknown;
      customerName?: unknown;
    };

    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const country = typeof body.country === 'string' ? body.country.toUpperCase() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';

    if (!text || text.length > 4000) {
      return NextResponse.json(
        { success: false, message: 'text is required and must be 4000 characters or fewer' },
        { status: 400 },
      );
    }

    if (country !== 'BD' && country !== 'IN') {
      return NextResponse.json(
        { success: false, message: 'country must be BD or IN' },
        { status: 400 },
      );
    }

    const aiSettings = await getWhatsAppAISettings();

    if (!aiSettings.is_enabled || !aiSettings.feature_flags.customer_support_ai) {
      return NextResponse.json({
        success: true,
        ai_enabled: false,
        reason: !aiSettings.is_enabled ? 'ai_settings_disabled' : 'customer_support_ai_disabled',
      });
    }

    const agent = await runWhatsAppAgent({
      text,
      country: country as 'BD' | 'IN',
      customerPhone: phone || null,
      customerName: customerName || null,
      aiSettings,
    });

    return NextResponse.json({
      success: true,
      ai_enabled: true,
      response: agent.content,
      model: agent.model,
      tool_calls: agent.toolCalls.map((tool) => ({
        name: tool.name,
        args: tool.args,
        result: tool.result,
      })),
      note: 'Internal test only. No WhatsApp message was sent and no order was created.',
    });
  } catch (error) {
    console.error('WhatsApp AI internal test failed', error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'WhatsApp AI internal test failed',
      },
      { status: 500 },
    );
  }
}
