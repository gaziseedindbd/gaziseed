import type { Metadata } from 'next';
import { getServerRow, pageMetadata } from '@/lib/seo-metadata';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getServerRow('categories', 'slug', slug);
  const title = category?.name_bn || category?.name_en || 'Category';
  const description = category?.description || `বীজ ও কৃষি পণ্যের ${title} ক্যাটাগরি — GAZI SEED`;
  const image = category?.banner || category?.image || null;
  return pageMetadata({ title: `${title} | GAZI SEED`, description, image, path: `/category/${slug}` });
}

export default function CategorySlugLayout({ children }: { children: React.ReactNode }) {
  return children;
}
