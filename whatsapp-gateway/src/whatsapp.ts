import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  type WASocket,
} from '@whiskeysockets/baileys';
import P from 'pino';
import { config } from './config.js';
import { forwardToGaziSeed } from './webhook.js';
import type { Country, NormalizedInboundMessage } from './types.js';

const logger = P({ level: process.env.LOG_LEVEL || 'info' });

function resolveCountry(businessNumber: string): Country | null {
  const normalized = businessNumber.replace(/[^0-9]/g, '');
  const bd = config.bdBusinessNumber.replace(/[^0-9]/g, '');
  const india = config.inBusinessNumber.replace(/[^0-9]/g, '');

  if (bd && normalized === bd) return 'BD';
  if (india && normalized === india) return 'IN';
  return null;
}

function normalizeJid(jid: string): string {
  return jid.split(':')[0];
}

export async function startWhatsApp() {
  if (!config.enabled) {
    logger.info('WhatsApp gateway disabled. Set WHATSAPP_GATEWAY_ENABLED=true to start.');
    return;
  }

  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  let socket: WASocket;

  const connect = () => {
    socket = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      logger,
      markOnlineOnConnect: false,
    });

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', ({ connection, lastDisconnect }) => {
      if (connection === 'open') {
        logger.info('WhatsApp gateway connected');
        return;
      }

      if (connection === 'close') {
        const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        if (code !== DisconnectReason.loggedOut) {
          logger.warn({ code }, 'WhatsApp connection closed; reconnecting');
          setTimeout(connect, 2000);
        } else {
          logger.warn('WhatsApp session logged out; delete local auth and scan QR again');
        }
      }
    });

    socket.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const message of messages) {
        if (message.key.fromMe || !message.message) continue;

        const text =
          message.message.conversation ||
          message.message.extendedTextMessage?.text ||
          '';

        if (!text.trim()) continue;

        const remoteJid = message.key.remoteJid || '';
        const phone = normalizeJid(remoteJid).replace(/[^0-9]/g, '');
        const businessNumber = socket.user?.id ? normalizeJid(socket.user.id).split('@')[0] : '';
        const country = resolveCountry(businessNumber);

        if (!country) {
          logger.warn({ businessNumber }, 'Business number is not configured for BD/IN routing');
          continue;
        }

        const inbound: NormalizedInboundMessage = {
          channel: 'whatsapp',
          externalUserId: remoteJid,
          externalMessageId: message.key.id || `baileys-${Date.now()}`,
          phone,
          text: text.trim(),
          provider: 'baileys',
          metadata: {
            businessNumber,
            countryCode: country,
            customerName: message.pushName || undefined,
          },
        };

        try {
          const result = await forwardToGaziSeed(inbound);
          const response = typeof result.response === 'string' ? result.response : '';

          if (response && socket) {
            await socket.sendMessage(remoteJid, { text: response });
          }
        } catch (error) {
          logger.error({ error }, 'Failed to process inbound WhatsApp message');
        }
      }
    });
  };

  connect();
}
