# GAZI SEED WhatsApp Gateway Prototype

This folder documents the local/self-hosted gateway contract for the GAZI SEED WhatsApp AI integration.

## Safety defaults

The gateway must remain disabled until explicitly configured:

- `WHATSAPP_GATEWAY_ENABLED=false`
- `WHATSAPP_AI_ENABLED=false`
- No production WhatsApp number is required for development.
- Never commit WhatsApp session credentials, QR/session files, API keys, or webhook secrets.

## Architecture

WhatsApp Web session (QR)
-> local gateway
-> GAZI SEED `POST /api/whatsapp/webhook`
-> AI Agent
-> controlled Supabase tools
-> response
-> gateway
-> WhatsApp

## Normalized inbound contract

```json
{
  "channel": "whatsapp",
  "externalUserId": "customer-id",
  "externalMessageId": "message-id",
  "phone": "customer-phone",
  "text": "গোলাপ ফুলের বীজ কত টাকা?",
  "provider": "baileys",
  "metadata": {
    "businessNumber": "business-number",
    "countryCode": "BD"
  }
}
```

The gateway should send the secret header:

`x-whatsapp-webhook-secret: <server-side secret>`

## Local development

The gateway should run as a separate long-lived Node.js process. Vercel is only the application/webhook host; it should not own a persistent WhatsApp Web session.

Before connecting a real number, use a dedicated test WhatsApp account/number.

Do not enable production auto-replies until the inbound, AI, outbound, duplicate-message, and failure paths have been tested.
