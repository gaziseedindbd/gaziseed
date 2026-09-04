import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gaziseed.vercel.app').replace(/\/$/, '');

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: products }, { data: blogPosts }, { data: guides }, { data: videos }, { data: pages }] = await Promise.all([
    supabase.from('products').select('slug, updated_at').eq('active', true),
    supabase.from('blog_posts').select('slug, updated_at').eq('published', true),
    supabase.from('guides').select('slug, updated_at').eq('active', true),
    supabase.from('video_gallery').select('id, updated_at').eq('active', true),
    supabase.from('content_pages').select('slug, updated_at').eq('active', true),
  ]);

  const now = new Date();
  const staticRoutes = ['/', '/shop', '/blog', '/guides', '/videos', '/pages'];

  return [
    ...staticRoutes.map((path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: path === '/' ? 'daily' as const : 'weekly' as const,
      priority: path === '/' ? 1 : 0.7,
    })),
    ...(products ?? []).map((item) => ({
      url: `${SITE_URL}/product/${item.slug}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : now,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...(blogPosts ?? []).map((item) => ({
      url: `${SITE_URL}/blog/${item.slug}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...(guides ?? []).map((item) => ({
      url: `${SITE_URL}/guides/${item.slug}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
    ...(videos ?? []).map((item) => ({
      url: `${SITE_URL}/videos/${item.id}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
    ...(pages ?? []).map((item) => ({
      url: `${SITE_URL}/pages/${item.slug}`,
      lastModified: item.updated_at ? new Date(item.updated_at) : now,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];
}
