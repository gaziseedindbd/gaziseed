import 'dotenv/config';

function env(name: string, fallback = ''): string {
  return process.env[name]?.trim() || fallback;
}

export const config = {
  enabled: env('WHATSAPP_GATEWAY_ENABLED') === 'true',
  provider: env('WHATSAPP_GATEWAY_PROVIDER', 'baileys'),
  webhookUrl: env('GAZISEED_WEBHOOK_URL'),
  webhookSecret: env('WHATSAPP_WEBHOOK_SECRET'),
  bdBusinessNumber: env('WHATSAPP_BD_BUSINESS_NUMBER'),
  inBusinessNumber: env('WHATSAPP_IN_BUSINESS_NUMBER'),
  port: Number(env('PORT', '3100')),
};
