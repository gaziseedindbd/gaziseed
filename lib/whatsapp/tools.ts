import { createWhatsAppSupabase } from './server';

export interface ProductToolResult {
  found: boolean;
  products: Array<Record<string, unknown>>;
}

export async function searchProduct(query: string, country: 'BD' | 'IN' = 'BD'): Promise<ProductToolResult> {
  const q = query.trim();
  if (!q) return { found: false, products: [] };

  const supabase = createWhatsAppSupabase();
  const pattern = `%${q.replace(/[%_]/g, '')}%`;

  const { data, error } = await supabase
    .from('products')
    .select('id,name_bn,name_en,slug,sku,regular_price,sale_price,stock,low_stock_threshold,is_active,image,short_description_bn,description_bn,description_en,min_order_qty,max_order_qty,country_code')
    .eq('is_active', true)
    .eq('is_ads_only', false)
    .eq('country_code', country)
    .or(`name_bn.ilike.${pattern},name_en.ilike.${pattern},sku.ilike.${pattern},slug.ilike.${pattern}`)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw new Error(`Product search failed: ${error.message}`);

  return { found: Boolean(data?.length), products: data || [] };
}

export async function getProductDetails(productId: string, country: 'BD' | 'IN' = 'BD') {
  const supabase = createWhatsAppSupabase();

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .eq('country_code', country)
    .eq('is_active', true)
    .eq('is_ads_only', false)
    .maybeSingle();

  if (error) throw new Error(`Product details lookup failed: ${error.message}`);
  return data || null;
}

export async function getProductPrice(productId: string, country: 'BD' | 'IN' = 'BD') {
  const product = await getProductDetails(productId, country);
  if (!product) return null;

  return {
    product_id: product.id,
    name_bn: product.name_bn,
    name_en: product.name_en,
    regular_price: product.regular_price,
    sale_price: product.sale_price,
    effective_price: product.sale_price ?? product.regular_price,
    currency: country === 'IN' ? 'INR' : 'BDT',
  };
}

export async function checkStock(productId: string, country: 'BD' | 'IN' = 'BD') {
  const product = await getProductDetails(productId, country);
  if (!product) return null;

  return {
    product_id: product.id,
    name_bn: product.name_bn,
    stock: product.stock,
    low_stock_threshold: product.low_stock_threshold,
    is_available: Number(product.stock || 0) > 0,
    min_order_qty: product.min_order_qty,
    max_order_qty: product.max_order_qty,
  };
}

export async function getDeliveryCharge(
  orderValue: number,
  country: 'BD' | 'IN' = 'BD',
  freeDelivery = false,
) {
  const supabase = createWhatsAppSupabase();

  const { data, error } = await supabase
    .rpc('calculate_delivery_charge', {
      p_order_value: orderValue,
      p_free_delivery: freeDelivery,
    });

  if (error) throw new Error(`Delivery charge calculation failed: ${error.message}`);

  return {
    country,
    order_value: orderValue,
    free_delivery: freeDelivery,
    delivery_charge: Number(data || 0),
    currency: country === 'IN' ? 'INR' : 'BDT',
  };
}

export async function trackOrder(orderNumber: string, customerPhone: string) {
  const supabase = createWhatsAppSupabase();

  const { data, error } = await supabase.rpc('track_order', {
    p_order_number: orderNumber,
    p_customer_phone: customerPhone,
  });

  if (error) throw new Error(`Order tracking failed: ${error.message}`);

  return data || null;
}
