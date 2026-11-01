import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createMessengerCartContext, signMessengerCartContext } from '@/lib/ai/messenger-cart-context';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function failure(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > 12_000) return failure('Cart is too large.');
    body = JSON.parse(raw);
  } catch {
    return failure('Invalid request.');
  }

  if (!body || typeof body !== 'object') return failure('Invalid cart.');
  const input = body as Record<string, unknown>;
  const country = input.country;
  const language = input.language;
  const items = input.items;
  if ((country !== 'BD' && country !== 'IN') || (language !== 'bn' && language !== 'en' && language !== 'hi')) {
    return failure('Invalid country or language.');
  }
  if (!Array.isArray(items) || items.length < 1 || items.length > 20) return failure('Cart must contain 1–20 products.');

  const parsedItems: Array<{ product_id: string; quantity: number; unit_price: number }> = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item !== 'object') return failure('Invalid cart item.');
    const row = item as Record<string, unknown>;
    if (typeof row.product_id !== 'string' || !UUID_RE.test(row.product_id) || seen.has(row.product_id)) {
      return failure('Please refresh your cart and try again.');
    }
    if (row.variant_id || row.bundle_id) {
      return failure('For a quote, please use products without a selected variant or bundle. Your checkout remains unchanged.');
    }
    if (!Number.isInteger(row.quantity) || Number(row.quantity) < 1 || Number(row.quantity) > 99) {
      return failure('Invalid product quantity.');
    }
    if (typeof row.unit_price !== 'number' || !Number.isFinite(row.unit_price) || row.unit_price <= 0) {
      return failure('Please refresh your cart and try again.');
    }
    seen.add(row.product_id);
    parsedItems.push({ product_id: row.product_id, quantity: Number(row.quantity), unit_price: row.unit_price });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const pageId = process.env.META_PAGE_ID;
  if (!url || !serviceKey || !pageId || !/^\d+$/.test(pageId)) return failure('Messenger connection is not configured.', 503);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const ids = parsedItems.map((item) => item.product_id);
  const [{ data: products, error: productError }, { data: tiers, error: tierError }] = await Promise.all([
    admin.from('products')
      .select('id,country_code,is_active,stock,regular_price,sale_price,free_delivery,min_order_qty,max_order_qty')
      .in('id', ids)
      .eq('country_code', country)
      .eq('is_active', true),
    admin.from('bulk_pricing')
      .select('product_id,min_quantity,unit_price')
      .in('product_id', ids)
      .eq('country_code', country)
      .eq('is_active', true)
      .is('variant_id', null),
  ]);
  if (productError || tierError) {
    console.error('Messenger checkout context lookup failed:', productError?.message || tierError?.message);
    return failure('Could not verify your current cart prices. Please check out on the website.', 503);
  }

  const productById = new Map((products || []).map((product) => [product.id, product]));
  if (productById.size !== parsedItems.length) return failure('A cart product is no longer available. Refresh checkout and try again.', 409);

  const subtotal = parsedItems.reduce((sum, item) => {
    const product = productById.get(item.product_id);
    if (!product || Number(product.stock || 0) < item.quantity) return Number.NaN;
    if (product.min_order_qty && item.quantity < Number(product.min_order_qty)) return Number.NaN;
    if (product.max_order_qty && item.quantity > Number(product.max_order_qty)) return Number.NaN;
    const basePrice = Number(product.sale_price) > 0 && Number(product.sale_price) < Number(product.regular_price)
      ? Number(product.sale_price)
      : Number(product.regular_price);
    const tier = (tiers || [])
      .filter((candidate) => candidate.product_id === item.product_id && Number(candidate.min_quantity) <= item.quantity)
      .sort((a, b) => Number(b.min_quantity) - Number(a.min_quantity))[0];
    const unitPrice = tier ? Number(tier.unit_price) : basePrice;
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return Number.NaN;
    if (Math.round(unitPrice * 100) !== Math.round(item.unit_price * 100)) return Number.NaN;
    return sum + unitPrice * item.quantity;
  }, 0);
  if (!Number.isFinite(subtotal) || subtotal <= 0) return failure('A cart item could not be price-verified. Refresh checkout and try again.', 409);

  const context = createMessengerCartContext({
    country,
    subtotal: Math.round(subtotal * 100) / 100,
    hasFreeDeliveryProduct: parsedItems.some((item) => productById.get(item.product_id)?.free_delivery === true),
    language,
  });
  const token = signMessengerCartContext(context);
  if (!token || token.length > 900) return failure('Messenger connection is not configured.', 503);

  return NextResponse.json(
    { url: `https://m.me/${pageId}?ref=${encodeURIComponent(token)}` },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
