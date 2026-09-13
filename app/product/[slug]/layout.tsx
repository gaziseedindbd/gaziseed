import type { Metadata } from 'next';
import { getServerRow, pageMetadata } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getServerRow('products', 'slug', slug);
  const title = product?.name_bn || product?.name_en || 'Product';
  const description = product?.short_description || product?.description || `${title} — SUPER KING SEED`;
  const image = product?.image || product?.images?.[0] || null;
  return pageMetadata({ title: `${title} | SUPER KING SEED`, description, image, path: `/product/${slug}` });
}

export default function ProductSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
