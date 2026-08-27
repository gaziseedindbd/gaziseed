'use client';

import { supabase } from './supabase/client';
import { formatPrice, formatPriceEn } from './supabase/client';
export { formatPrice, formatPriceEn };
import type {
  Category, Product, Service, Banner, BlogPost, Testimonial,
  Announcement, Navigation, SiteSettings, HomepageSection,
  BundleOffer, LandingPage, DeliveryZone, Review, Page,
  ComboPack, ComboItem, Promotion, PromotionGift, ProductBatch, StockNotification, ProductFaq,
  ProductVariant, BulkPricing, Wishlist, SupportTicket, SupportTicketReply, CustomerTag,
} from './supabase/types';

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const { data } = await supabase
    .from('site_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  return data as SiteSettings | null;
}

export async function getNavigation(): Promise<Navigation[]> {
  const { data } = await supabase
    .from('navigation')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []) as Navigation[];
}

export async function getAnnouncements(): Promise<Announcement[]> {
  const { data } = await supabase
    .from('announcements')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []) as Announcement[];
}

export async function getBanners(): Promise<Banner[]> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('banners')
    .select('*')
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order('display_order', { ascending: true });
  return (data || []) as Banner[];
}

export async function getCategories(): Promise<Category[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []) as Category[];
}

export async function getCategoryBySlug(slug: string): Promise<Category | null> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  return data as Category | null;
}

export async function getProducts(filters?: {
  category_id?: string;
  search?: string;
  is_featured?: boolean;
  is_best_seller?: boolean;
  is_new_arrival?: boolean;
  is_seasonal?: boolean;
  limit?: number;
}): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('is_ads_only', false)
    .order('created_at', { ascending: false });

  if (filters?.category_id) {
    query = query.eq('category_id', filters.category_id);
  }
  if (filters?.search) {
    query = query.or(`name_bn.ilike.%${filters.search}%,name_en.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
  }
  if (filters?.is_featured) {
    query = query.eq('is_featured', true);
  }
  if (filters?.is_best_seller) {
    query = query.eq('is_best_seller', true);
  }
  if (filters?.is_new_arrival) {
    query = query.eq('is_new_arrival', true);
  }
  if (filters?.is_seasonal) {
    query = query.eq('is_seasonal', true);
  }
  if (filters?.limit) {
    query = query.limit(filters.limit);
  }

  const { data } = await query;
  return (data || []) as Product[];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();
  return data as Product | null;
}

export async function getProductById(id: string): Promise<Product | null> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return data as Product | null;
}

export async function getBundleOffers(productId: string): Promise<BundleOffer[]> {
  const { data } = await supabase
    .from('bundle_offers')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []) as BundleOffer[];
}

export async function getLandingPage(productId: string): Promise<LandingPage | null> {
  const { data } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('product_id', productId)
    .eq('is_enabled', true)
    .maybeSingle();
  return data as LandingPage | null;
}

export async function getDeliveryZones(): Promise<DeliveryZone[]> {
  const { data } = await supabase
    .from('delivery_zones')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []) as DeliveryZone[];
}

export async function getServices(): Promise<Service[]> {
  const { data } = await supabase
    .from('services')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []) as Service[];
}

export async function getTestimonials(): Promise<Testimonial[]> {
  const { data } = await supabase
    .from('testimonials')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true });
  return (data || []) as Testimonial[];
}

export async function getReviews(productId: string): Promise<Review[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('is_approved', true)
    .order('created_at', { ascending: false });
  return (data || []) as Review[];
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('is_published', true)
    .order('publish_date', { ascending: false });
  return (data || []) as BlogPost[];
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  return data as BlogPost | null;
}

export async function getHomepageSections(): Promise<HomepageSection[]> {
  const { data } = await supabase
    .from('homepage_sections')
    .select('*')
    .eq('is_enabled', true)
    .order('display_order', { ascending: true });
  return (data || []) as HomepageSection[];
}

export async function getPageBySlug(slug: string): Promise<Page | null> {
  const { data } = await supabase
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle();
  return data as Page | null;
}

export async function getLandingPageBySlug(landingSlug: string, includeAllStatuses = false): Promise<{ landing: LandingPage | null; product: Product | null }> {
  let query = supabase
    .from('landing_pages')
    .select('*')
    .eq('landing_slug', landingSlug);
  if (!includeAllStatuses) {
    query = query.in('status', ['active']);
  }
  const { data: landing } = await query.maybeSingle();
  if (!landing) return { landing: null, product: null };
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', landing.product_id)
    .maybeSingle();
  return { landing: landing as LandingPage, product: product as Product };
}

export async function trackLandingPageView(landingPageId: string, utm: Record<string, string>) {
  await supabase.from('landing_page_views').insert({
    landing_page_id: landingPageId,
    utm_source: utm.utm_source || '',
    utm_medium: utm.utm_medium || '',
    utm_campaign: utm.utm_campaign || '',
    utm_content: utm.utm_content || '',
    utm_term: utm.utm_term || '',
    fbclid: utm.fbclid || '',
    gclid: utm.gclid || '',
  });
}

export async function getOfferProducts(): Promise<{ product: Product; landing: LandingPage }[]> {
  const { data: landings } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('status', 'active');
  if (!landings || landings.length === 0) return [];
  const productIds = landings.map((l) => l.product_id);
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .in('id', productIds)
    .eq('is_active', true);
  const productMap = new Map((products || []).map((p) => [p.id, p]));
  return landings
    .map((l) => ({ landing: l as LandingPage, product: productMap.get(l.product_id) as Product }))
    .filter((item) => item.product);
}

export function getEffectivePrice(product: Product): number {
  if (product.sale_price && product.sale_price > 0 && product.sale_price < product.regular_price) {
    return product.sale_price;
  }
  return product.regular_price;
}

export function getDiscountPercent(product: Product): number {
  if (product.sale_price && product.sale_price > 0 && product.sale_price < product.regular_price) {
    return Math.round(((product.regular_price - product.sale_price) / product.regular_price) * 100);
  }
  return 0;
}

export async function getRelatedProducts(productId: string, relatedIds: string[]): Promise<Product[]> {
  if (!relatedIds || relatedIds.length === 0) return [];
  const { data } = await supabase.from('products').select('*').in('id', relatedIds).eq('is_active', true);
  return (data || []) as Product[];
}

export async function getProductFaqs(productId: string): Promise<ProductFaq[]> {
  const { data } = await supabase.from('product_faqs').select('*').eq('product_id', productId).eq('is_active', true).order('display_order');
  return (data || []) as ProductFaq[];
}

export async function getActivePromotions(): Promise<{ promotion: Promotion; gifts: PromotionGift[]; giftProducts: Product[] }[]> {
  const now = new Date().toISOString();
  const { data: promos } = await supabase.from('promotions').select('*').eq('is_active', true).or(`start_date.is.null,start_date.lte.${now}`).or(`end_date.is.null,end_date.gte.${now}`);
  if (!promos || promos.length === 0) return [];
  const results: { promotion: Promotion; gifts: PromotionGift[]; giftProducts: Product[] }[] = [];
  for (const p of promos as Promotion[]) {
    const { data: gifts } = await supabase.from('promotion_gifts').select('*').eq('promotion_id', p.id);
    const giftList = (gifts || []) as PromotionGift[];
    if (giftList.length === 0) continue;
    const productIds = giftList.map((g) => g.product_id);
    const { data: products } = await supabase.from('products').select('*').in('id', productIds).eq('is_active', true).gt('stock', 0);
    const giftProducts = (products || []) as Product[];
    if (giftProducts.length === 0) continue;
    results.push({ promotion: p, gifts: giftList, giftProducts });
  }
  return results;
}

export async function getComboPacks(): Promise<{ combo: ComboPack; items: { product: Product; quantity: number }[] }[]> {
  const { data: combos } = await supabase.from('combo_packs').select('*').eq('is_active', true).order('display_order');
  if (!combos || combos.length === 0) return [];
  const results: { combo: ComboPack; items: { product: Product; quantity: number }[] }[] = [];
  for (const c of combos as ComboPack[]) {
    const { data: items } = await supabase.from('combo_items').select('*, products(*)').eq('combo_id', c.id);
    const comboItems = (items || []).map((item: any) => ({ product: item.products as Product, quantity: item.quantity })).filter((item: any) => item.product);
    if (comboItems.length === 0) continue;
    results.push({ combo: c, items: comboItems });
  }
  return results;
}

export async function getComboPackBySlug(slug: string): Promise<{ combo: ComboPack; items: { product: Product; quantity: number }[] } | null> {
  const { data: combo } = await supabase.from('combo_packs').select('*').eq('slug', slug).eq('is_active', true).maybeSingle();
  if (!combo) return null;
  const { data: items } = await supabase.from('combo_items').select('*, products(*)').eq('combo_id', (combo as ComboPack).id);
  const comboItems = (items || []).map((item: any) => ({ product: item.products as Product, quantity: item.quantity })).filter((item: any) => item.product);
  return { combo: combo as ComboPack, items: comboItems };
}

export async function getProductVariants(productId: string): Promise<ProductVariant[]> {
  const { data } = await supabase.from('product_variants').select('*').eq('product_id', productId).eq('is_active', true).order('display_order');
  return (data || []) as ProductVariant[];
}

export async function getBulkPricing(productId: string, variantId?: string): Promise<BulkPricing[]> {
  let query = supabase.from('bulk_pricing').select('*').eq('product_id', productId).eq('is_active', true).order('min_quantity');
  if (variantId) query = query.eq('variant_id', variantId);
  else query = query.is('variant_id', null);
  const { data } = await query;
  return (data || []) as BulkPricing[];
}

export async function getWishlist(userId: string): Promise<Product[]> {
  const { data } = await supabase.from('wishlists').select('product_id, products(*)').eq('user_id', userId);
  return (data || []).map((w: any) => w.products).filter(Boolean) as Product[];
}

export async function toggleWishlist(userId: string, productId: string): Promise<boolean> {
  const { data: existing } = await supabase.from('wishlists').select('id').eq('user_id', userId).eq('product_id', productId).maybeSingle();
  if (existing) {
    await supabase.from('wishlists').delete().eq('id', existing.id);
    return false;
  }
  await supabase.from('wishlists').insert({ user_id: userId, product_id: productId });
  return true;
}

export async function getSupportTickets(userId?: string): Promise<SupportTicket[]> {
  let query = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data } = await query;
  return (data || []) as SupportTicket[];
}

export async function getSeasonalProducts(month: string, growingType?: string): Promise<Product[]> {
  let query = supabase.from('products').select('*').eq('is_active', true).eq('is_ads_only', false).contains('suitable_months', [month]);
  if (growingType) query = query.eq('growing_type', growingType);
  const { data } = await query.limit(12);
  return (data || []) as Product[];
}

export async function getThisMonthSeeds(): Promise<Product[]> {
  const months = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
  const month = months[new Date().getMonth()];
  return getSeasonalProducts(month);
}

export function getRecentlyViewed(): Product[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem('gazi_recently_viewed');
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

export function addRecentlyViewed(product: Product) {
  if (typeof window === 'undefined') return;
  try {
    let items = getRecentlyViewed();
    items = items.filter((p) => p.id !== product.id);
    items.unshift(product);
    items = items.slice(0, 10);
    localStorage.setItem('gazi_recently_viewed', JSON.stringify(items));
  } catch {}
}
