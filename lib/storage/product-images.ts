import { supabase } from '@/lib/supabase/client';

function getStoragePathFromPublicUrl(url: string, bucket: string): string | null {
  try {
    const parsed = new URL(url);
    const marker = `/storage/v1/object/public/${bucket}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index === -1) return null;

    const path = parsed.pathname.slice(index + marker.length);
    return path ? decodeURIComponent(path) : null;
  } catch {
    return null;
  }
}

export function getProductImageUrls(product: { image?: string | null; images?: unknown }): string[] {
  const urls = new Set<string>();

  if (product.image) urls.add(product.image);

  if (Array.isArray(product.images)) {
    for (const image of product.images) {
      if (typeof image === 'string' && image) urls.add(image);
    }
  }

  return [...urls];
}

export async function deleteProductImagesFromStorage(
  supabaseClient: typeof supabase,
  urls: string[],
  bucket = 'product-images',
  excludeProductId?: string | null,
): Promise<{ deleted: string[]; skippedReferenced: string[]; failed: string[] }> {
  const paths = [...new Set(
    urls
      .map((url) => getStoragePathFromPublicUrl(url, bucket))
      .filter((path): path is string => Boolean(path)),
  )];

  if (paths.length === 0) {
    return { deleted: [], skippedReferenced: [], failed: [] };
  }

  const deleted: string[] = [];
  const skippedReferenced: string[] = [];
  const failed: string[] = [];

  for (const path of paths) {
    const publicUrl = supabaseClient.storage.from(bucket).getPublicUrl(path).data.publicUrl;

    let query = supabaseClient
      .from('products')
      .select('id')
      .eq('image', publicUrl)
      .limit(1);

    if (excludeProductId) query = query.neq('id', excludeProductId);

    const { data: directReferences, error: directReferenceError } = await query;

    if (directReferenceError) {
      failed.push(path);
      continue;
    }

    let arrayQuery = supabaseClient
      .from('products')
      .select('id')
      .contains('images', [publicUrl])
      .limit(1);

    if (excludeProductId) arrayQuery = arrayQuery.neq('id', excludeProductId);

    const { data: arrayReferences, error: arrayReferenceError } = await arrayQuery;

    if (arrayReferenceError) {
      failed.push(path);
      continue;
    }

    if ((directReferences?.length ?? 0) > 0 || (arrayReferences?.length ?? 0) > 0) {
      skippedReferenced.push(path);
      continue;
    }

    const { error } = await supabaseClient.storage.from(bucket).remove([path]);

    if (error) {
      failed.push(path);
    } else {
      deleted.push(path);
    }
  }

  return { deleted, skippedReferenced, failed };
}
