import { createWhatsAppSupabase } from '@/lib/whatsapp/server';
import type {
  ProductRefArgs,
  ProductSearchArgs,
  WhatsAppToolProduct,
  WhatsAppToolResult,
} from './types';

const PRODUCT_FIELDS = [
  'id',
  'name_bn',
  'name_en',
  'slug',
  'sku',
  'regular_price',
  'sale_price',
  'stock',
  'min_order_qty',
  'max_order_qty',
  'packet_weight',
  'seed_type',
  'variety',
  'brand',
  'image',
  'free_delivery',
  'country_code',
].join(',');

function normalizeLimit(value?: number): number {
  if (!Number.isFinite(value)) return 5;
  return Math.min(Math.max(Math.floor(value as number), 1), 10);
}

function mapProduct(row: Record<string, unknown>): WhatsAppToolProduct {
  return {
    id: String(row.id),
    name_bn: row.name_bn as string | null,
    name_en: row.name_en as string | null,
    slug: row.slug as string | null,
    sku: row.sku as string | null,
    regular_price: row.regular_price as number | null,
    sale_price: row.sale_price as number | null,
    stock: row.stock as number | null,
    min_order_qty: row.min_order_qty as number | null,
    max_order_qty: row.max_order_qty as number | null,
    packet_weight: row.packet_weight as string | null,
    seed_type: row.seed_type as string | null,
    variety: row.variety as string | null,
    brand: row.brand as string | null,
    image: row.image as string | null,
    free_delivery: row.free_delivery as boolean | null,
    country_code: row.country_code as string | null,
  };
}

export async function searchProduct(args: ProductSearchArgs): Promise<WhatsAppToolResult<WhatsAppToolProduct[]>> {
  const query = args.query.trim();
  if (query.length < 2) return { ok: false, error: 'Product search query must contain at least 2 characters.' };

  const country = args.country;
  const limit = normalizeLimit(args.limit);
  const supabase = createWhatsAppSupabase(country);

  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('is_active', true)
    .eq('is_ads_only', false)
    .eq('country_code', country)
     .or(`name_bn.ilike.%${query}%,name_en.ilike.%${query}%,sku.ilike.%${query}%,slug.ilike.%${query}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { ok: false, error: `Product search failed: ${error.message}` };

  return { ok: true, data: (data || []).map((row) => mapProduct(row as Record<string, unknown>)) };
}

export async function getProductDetails(args: ProductRefArgs): Promise<WhatsAppToolResult<WhatsAppToolProduct>> {
  if (!args.productId?.trim()) return { ok: false, error: 'Product id is required.' };

  const supabase = createWhatsAppSupabase(args.country);
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('id', args.productId)
    .eq('is_active', true)
    .eq('is_ads_only', false)
    .eq('country_code', args.country)
    .maybeSingle();

  if (error) return { ok: false, error: `Product lookup failed: ${error.message}` };
  if (!data) return { ok: false, error: 'Product not found.' };

  return { ok: true, data: mapProduct(data as Record<string, unknown>) };
}

export async function getProductPrice(args: ProductRefArgs): Promise<WhatsAppToolResult<{
  product_id: string;
  price: number | null;
  regular_price: number | null;
  sale_price: number | null;
  currency: 'BDT' | 'INR';
}>> {
  const result = await getProductDetails(args);
  if (!result.ok || !result.data) return { ok: false, error: result.error || 'Product not found.' };

  const p = result.data;
  const price = p.sale_price ?? p.regular_price ?? null;

  return {
    ok: true,
    data: {
      product_id: p.id,
      price,
      regular_price: p.regular_price,
      sale_price: p.sale_price,
      currency: args.country === 'BD' ? 'BDT' : 'INR',
    },
  };
}

export async function checkStock(args: ProductRefArgs): Promise<WhatsAppToolResult<{
  product_id: string;
  stock: number;
  available: boolean;
  min_order_qty: number | null;
  max_order_qty: number | null;
}>> {
  const result = await getProductDetails(args);
  if (!result.ok || !result.data) return { ok: false, error: result.error || 'Product not found.' };

  const stock = Number(result.data.stock ?? 0);
  return {
    ok: true,
    data: {
      product_id: result.data.id,
      stock: Number.isFinite(stock) ? stock : 0,
      available: Number.isFinite(stock) && stock > 0,
      min_order_qty: result.data.min_order_qty,
      max_order_qty: result.data.max_order_qty,
    },
  };
}
