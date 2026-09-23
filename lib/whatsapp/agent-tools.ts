import {
  checkStock,
  getDeliveryCharge,
  getProductDetails,
  getProductPrice,
  searchProduct,
  trackOrder,
} from './tools';

export const WHATSAPP_TOOL_NAMES = [
  'search_product',
  'get_product_details',
  'get_product_price',
  'check_stock',
  'get_delivery_charge',
  'track_order',
] as const;

export type WhatsAppToolName = (typeof WHATSAPP_TOOL_NAMES)[number];

export async function runWhatsAppTool(
  name: WhatsAppToolName,
  args: Record<string, unknown>,
  country: 'BD' | 'IN' = 'BD',
): Promise<unknown> {
  switch (name) {
    case 'search_product':
      return searchProduct(String(args.query || ''), country);
    case 'get_product_details':
      return getProductDetails(String(args.product_id || ''), country);
    case 'get_product_price':
      return getProductPrice(String(args.product_id || ''), country);
    case 'check_stock':
      return checkStock(String(args.product_id || ''), country);
    case 'get_delivery_charge':
      return getDeliveryCharge(
        Number(args.order_value || 0),
        country,
        Boolean(args.free_delivery),
      );
    case 'track_order':
      return trackOrder(String(args.order_number || ''), String(args.customer_phone || ''));
    default:
      throw new Error(`Unsupported WhatsApp tool: ${name}`);
  }
}
