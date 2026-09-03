import type { Metadata } from 'next';
import { getServerRow, pageMetadata, SITE_URL } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const combo = await getServerRow('combo_packs', 'slug', params.slug);
  const title = combo?.title_bn || combo?.title_en || 'Combo Offer';
  const description = combo?.description_bn || combo?.description_en || `${title} — SUPER KING SEED`;

  // Use a server-generated PNG for Facebook/Meta. This avoids unreliable previews
  // when the stored product image is WebP or hosted on a remote storage provider.
  const ogImage = `${SITE_URL}/api/og/combo/${encodeURIComponent(params.slug)}?v=2`;

  return pageMetadata({
    title: `${title} | SUPER KING SEED`,
    description,
    image: ogImage,
    path: `/combo/${params.slug}`,
  });
}

export default function ComboSlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
