import 'server-only';

import { createClient } from '@/lib/supabase/server';
import type { CountryCode } from '@/lib/seed-bari/domain';

export async function getActiveBanners(country: CountryCode) {
  const supabase = await createClient();
  return supabase
    .from('banners')
    .select('id,country,title,image_url,mobile_image_url,link_url,active,starts_at,expires_at,sort_order')
    .eq('country', country)
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
    .order('sort_order', { ascending: true });
}

export async function getActivePromotionalPopup(country: CountryCode) {
  const supabase = await createClient();
  return supabase
    .from('promotional_popups')
    .select('id,country,title,description,image_url,cta_link,offer_text,cta_text,starts_at,expires_at,closeable,display_frequency,delay_seconds,active')
    .or(`country.eq.${country},country.is.null`)
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${new Date().toISOString()}`)
    .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
    .order('starts_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
}

export async function getActiveLandingPage(country: CountryCode, slugOrId: string) {
  const supabase = await createClient();
  const bySlug = await supabase
    .from('landing_pages')
    .select('id,country,title,slug,type,content,animated,active,created_by,created_at,updated_at')
    .eq('country', country)
    .eq('slug', slugOrId)
    .eq('active', true)
    .maybeSingle();

  if (bySlug.data || bySlug.error) return bySlug;

  return supabase
    .from('landing_pages')
    .select('id,country,title,slug,type,content,animated,active,created_by,created_at,updated_at')
    .eq('country', country)
    .eq('id', slugOrId)
    .eq('active', true)
    .maybeSingle();
}

export async function getActiveCampaigns(country: CountryCode) {
  const supabase = await createClient();
  const now = new Date().toISOString();
  return supabase
    .from('campaigns')
    .select('id,country,name,platform,source,medium,campaign_code,landing_page_id,budget,starts_at,ends_at,active')
    .eq('country', country)
    .eq('active', true)
    .or(`starts_at.is.null,starts_at.lte.${now}`)
    .or(`ends_at.is.null,ends_at.gte.${now}`)
    .order('created_at', { ascending: false });
}

export async function getPublishedContentPages(country: CountryCode) {
  const supabase = await createClient();
  return supabase
    .from('content_pages')
    .select('id,country,page_type,slug,title_bn,title_en,content_bn,content_en,active')
    .or(`country.eq.${country},country.is.null`)
    .eq('active', true)
    .order('page_type')
    .order('slug');
}

export async function getPublishedContentPage(country: CountryCode, slug: string) {
  const supabase = await createClient();
  return supabase
    .from('content_pages')
    .select('id,country,page_type,slug,title_bn,title_en,content_bn,content_en,active')
    .or(`country.eq.${country},country.is.null`)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
}

export async function getPublishedBlogPosts(country: CountryCode, limit = 12) {
  const supabase = await createClient();
  return supabase
    .from('blog_posts')
    .select('id,country,title_bn,title_en,slug,excerpt,content_bn,content_en,cover_image_url,published,published_at')
    .or(`country.eq.${country},country.is.null`)
    .eq('published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
}

export async function getPublishedBlogPost(country: CountryCode, slug: string) {
  const supabase = await createClient();
  return supabase
    .from('blog_posts')
    .select('id,country,title_bn,title_en,slug,excerpt,content_bn,content_en,cover_image_url,published,published_at')
    .or(`country.eq.${country},country.is.null`)
    .eq('slug', slug)
    .eq('published', true)
    .maybeSingle();
}

export async function getActiveGuides(country: CountryCode, limit = 12) {
  const supabase = await createClient();
  return supabase
    .from('guides')
    .select('id,country,title_bn,title_en,slug,content_bn,content_en,active')
    .or(`country.eq.${country},country.is.null`)
    .eq('active', true)
    .order('slug')
    .limit(limit);
}

export async function getActiveGuide(country: CountryCode, slug: string) {
  const supabase = await createClient();
  return supabase
    .from('guides')
    .select('id,country,title_bn,title_en,slug,content_bn,content_en,active')
    .or(`country.eq.${country},country.is.null`)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
}

export async function getActiveVideos(country: CountryCode, limit = 12) {
  const supabase = await createClient();
  return supabase
    .from('video_gallery')
    .select('id,country,title,youtube_url,description,active,sort_order')
    .or(`country.eq.${country},country.is.null`)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .limit(limit);
}

export async function getActiveVideo(country: CountryCode, id: string) {
  const supabase = await createClient();
  return supabase
    .from('video_gallery')
    .select('id,country,title,youtube_url,description,active,sort_order')
    .or(`country.eq.${country},country.is.null`)
    .eq('id', id)
    .eq('active', true)
    .maybeSingle();
}
