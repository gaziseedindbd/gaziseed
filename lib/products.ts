import { createClient } from '@/lib/supabase/server';

export async function getActiveProducts(country: 'BD' | 'IN') {
  const supabase = await createClient();

  // Keep the base product query flat. The previous nested select caused
  // PostgREST to return HTTP 300 in production when embedding product_images
  // and product_variants together, which made the homepage show a generic
  // "Unable to load products" error.
  const { data: products, error } = await supabase
    .from('products')
    .select(
      'id,name_en,name_bn,slug,sku,regular_price,sale_price,short_description,category_id,featured,bestseller,is_new,seasonal,created_at'
    )
    .eq('active', true)
    .eq('country', country)
    .order('featured', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return { data: null, error };
  if (!products?.length) return { data: [], error: null };

  const ids = products.map((product) => product.id);

  const [{ data: images, error: imagesError }, { data: variants, error: variantsError }] =
    await Promise.all([
      supabase
        .from('product_images')
        .select('id,product_id,optimized_url,source_url,sort_order')
        .in('product_id', ids)
        .order('sort_order', { ascending: true }),
      supabase
        .from('product_variants')
        .select('id,product_id,name,price,sale_price,stock,sku,active')
        .in('product_id', ids),
    ]);

  if (imagesError) return { data: null, error: imagesError };
  if (variantsError) return { data: null, error: variantsError };

  const imagesByProduct = new Map<string, typeof images>();
  for (const image of images ?? []) {
    const list = imagesByProduct.get(image.product_id) ?? [];
    list.push(image);
    imagesByProduct.set(image.product_id, list);
  }

  const variantsByProduct = new Map<string, typeof variants>();
  for (const variant of variants ?? []) {
    const list = variantsByProduct.get(variant.product_id) ?? [];
    list.push(variant);
    variantsByProduct.set(variant.product_id, list);
  }

  return {
    data: products.map((product) => ({
      ...product,
      product_images: imagesByProduct.get(product.id) ?? [],
      product_variants: variantsByProduct.get(product.id) ?? [],
    })),
    error: null,
  };
}
