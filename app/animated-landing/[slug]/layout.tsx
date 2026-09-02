import type { Metadata } from 'next';
import { getServerRow, getServerProductById, pageMetadata } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const landing = await getServerRow('animated_landing_pages', 'slug', params.slug);
  const product = landing ? await getServerProductById(landing.product_id) : null;
  const title = landing?.hero_title || landing?.landing_name || product?.name_bn || product?.name_en || 'Animated Product Offer';
  const description = landing?.hero_subtitle || product?.short_description || 'Premium animated product offer from SUPER KING SEED.';
  const image = landing?.hero_image || product?.image || product?.images?.[0] || null;
  return pageMetadata({ title: `${title} | SUPER KING SEED`, description, image, path: `/animated-landing/${params.slug}` });
}

export default function AnimatedLandingSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
