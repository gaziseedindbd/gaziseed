export type WhatsAppToolCountry = 'BD' | 'IN';

export interface ProductSearchArgs {
  query: string;
  country: WhatsAppToolCountry;
  limit?: number;
}

export interface ProductRefArgs {
  productId: string;
  country: WhatsAppToolCountry;
}

export interface DeliveryChargeArgs {
  orderValue: number;
  country: WhatsAppToolCountry;
  freeDelivery?: boolean;
}

export interface WhatsAppToolProduct {
  id: string;
  name_bn: string | null;
  name_en: string | null;
  slug: string | null;
  sku: string | null;
  short_description: string | null;
  regular_price: number | null;
  sale_price: number | null;
  offer_price: number | null;
  price: number | null;
  stock: number | null;
  min_order_qty: number | null;
  max_order_qty: number | null;
  packet_weight: string | null;
  seed_type: string | null;
  variety: string | null;
  brand: string | null;
  image: string | null;
  free_delivery: boolean | null;
  country_code: string | null;
}

export interface WhatsAppToolResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}
