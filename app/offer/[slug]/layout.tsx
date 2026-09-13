import type { Metadata } from 'next';
import { getServerRow, getServerProductById, pageMetadata } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const landing = await getServerRow('landing_pages', 'landing_slug', slug);
  const product = landing ? await getServerProductById(landing.product_id) : null;
  const title = landing?.title || landing?.landing_name || product?.name_bn || product?.name_en || 'Special Offer';
  const description = landing?.subtitle || landing?.description || product?.short_description || `${title} — SUPER KING SEED`;
  const image = landing?.images?.[0] || product?.image || product?.images?.[0] || null;
  return pageMetadata({ title: `${title} | SUPER KING SEED`, description, image, path: `/offer/${slug}` });
}

export default function OfferSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
