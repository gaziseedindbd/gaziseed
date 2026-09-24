import { mockWhatsAppGateway } from './mock';
import type { WhatsAppGateway } from './types';

export function getWhatsAppGateway(): WhatsAppGateway {
  const provider = process.env.WHATSAPP_GATEWAY_PROVIDER || 'mock';

  if (provider === 'mock') return mockWhatsAppGateway;

  throw new Error(`Unsupported WhatsApp gateway provider: ${provider}`);
}

export function isWhatsAppGatewayEnabled(): boolean {
  return process.env.WHATSAPP_GATEWAY_ENABLED === 'true';
}

export type { WhatsAppGateway, WhatsAppGatewayProvider, WhatsAppSendInput } from './types';
