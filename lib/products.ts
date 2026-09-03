import { createClient } from '@/lib/supabase/server';

export async function getActiveProducts(country: 'BD' | 'IN') {
  const supabase = await createClient();
  return supabase
    .from('products')
    .select('id,name_en,name_bn,slug,sku,regular_price,sale_price,short_description,category_id,featured,best_seller,is_new,seasonal,product_images(id,image_url,sort_order),product_variants(id,name,price,sale_price,stock,sku,active)')
    .eq('active', true)
    .eq('country_code', country)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });
}
