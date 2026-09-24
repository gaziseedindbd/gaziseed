export type Country = 'BD' | 'IN';

export interface NormalizedInboundMessage {
  channel: 'whatsapp';
  externalUserId: string;
  externalMessageId: string;
  phone: string;
  text: string;
  provider: 'baileys';
  metadata: {
    businessNumber: string;
    countryCode: Country;
    customerName?: string;
  };
}
