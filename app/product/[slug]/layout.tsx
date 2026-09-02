import type { Metadata } from 'next';
import { getServerRow, pageMetadata } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const product = await getServerRow('products', 'slug', params.slug);
  const title = product?.name_bn || product?.name_en || 'Product';
  const description = product?.short_description || product?.description || `${title} — SUPER KING SEED`;
  const image = product?.image || product?.images?.[0] || null;
  return pageMetadata({ title: `${title} | SUPER KING SEED`, description, image, path: `/product/${params.slug}` });
}

export default function ProductSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
