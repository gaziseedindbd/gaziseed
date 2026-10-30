import type { Metadata } from 'next';
import ProductDetailPage, { generateProductMetadata } from '@/components/site/product-detail-page';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return generateProductMetadata(slug, 'BD');
}

export default async function BangladeshProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ProductDetailPage slug={slug} country="BD" />;
}
