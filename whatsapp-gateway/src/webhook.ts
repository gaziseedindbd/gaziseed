import { config } from './config.js';
import type { NormalizedInboundMessage } from './types.js';

export async function forwardToGaziSeed(message: NormalizedInboundMessage) {
  if (!config.webhookUrl) throw new Error('GAZISEED_WEBHOOK_URL is not configured');
  if (!config.webhookSecret) throw new Error('WHATSAPP_WEBHOOK_SECRET is not configured');

  const response = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-whatsapp-webhook-secret': config.webhookSecret,
    },
    body: JSON.stringify(message),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`GAZI SEED webhook returned HTTP ${response.status}: ${body.slice(0, 500)}`);
  }

  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return { raw: body };
  }
}
