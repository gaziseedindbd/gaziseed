import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessengerProduct } from './messenger-product-tool';

export type MessengerRecommendationCountry = 'IN' | 'BD';

type RecommendationOrderItem = {
  product_id: string | null;
};

function effectivePrice(product: MessengerProduct): number | null {
  const prices = [
    product.offer_price,
    product.sale_price,
    product.price,
    product.regular_price,
  ];

  const valid = prices.filter(
    (value): value is number => typeof value === 'number' && value > 0,
  );

  return valid[0] ?? null;
}

function productName(product: MessengerProduct): string {
  return (
    product.name_bn ||
    product.name_en ||
    product.slug ||
    'পণ্য'
  );
}

function scoreProduct(
  product: MessengerProduct,
  purchasedIds: Set<string>,
): number {
  const relatedIds = Array.isArray(
    (product as MessengerProduct & { related_product_ids?: unknown }).related_product_ids,
  )
    ? ((product as MessengerProduct & { related_product_ids?: unknown }).related_product_ids as unknown[])
    : [];

  const relatedMatch = relatedIds.some(
    (value) => typeof value === 'string' && purchasedIds.has(value),
  );

  let score = 0;
  if (relatedMatch) score += 10;
  if (product.search_match_score) score += Number(product.search_match_score);
  return score;
}

export async function getMessengerCustomerRecommendations(args: {
  supabase: SupabaseClient;
  pageId: string;
  externalUserId: string;
  country: MessengerRecommendationCountry;
  limit?: number;
}): Promise<{
  reply: string;
  products: MessengerProduct[];
  personalized: boolean;
}> {
  const limit = Math.max(1, Math.min(args.limit ?? 3, 5));

  const { data: profile, error: profileError } = await args.supabase
    .from('messenger_customer_profiles')
    .select('phone')
    .eq('page_id', args.pageId)
    .eq('external_user_id', args.externalUserId)
    .eq('country_code', args.country)
    .maybeSingle();

  if (profileError) throw profileError;

  const phone =
    profile && typeof profile.phone === 'string' ? profile.phone.trim() : '';

  let purchasedIds: string[] = [];

  if (phone) {
    const { data: orders, error: ordersError } = await args.supabase
      .from('orders')
      .select('id')
      .eq('country_code', args.country)
      .eq('order_source', 'facebook_messenger_ai')
      .eq('customer_phone', phone)
      .order('created_at', { ascending: false })
      .limit(5);

    if (ordersError) throw ordersError;

    const orderIds = (orders || [])
      .map((order) => (typeof order.id === 'string' ? order.id : ''))
      .filter(Boolean);

    if (orderIds.length) {
      const { data: items, error: itemError } = await args.supabase
        .from('order_items')
        .select('product_id')
        .in('order_id', orderIds);

      if (itemError) throw itemError;

      purchasedIds = Array.from(
        new Set(
          ((items || []) as RecommendationOrderItem[])
            .map((item) => item.product_id)
            .filter((value): value is string => typeof value === 'string' && value.length > 0),
        ),
      );
    }
  }

  const purchasedSet = new Set(purchasedIds);

  const { data: catalog, error: catalogError } = await args.supabase
    .from('products')
    .select(
      [
        'id',
        'name_bn',
        'name_en',
        'slug',
        'short_description',
        'image',
        'regular_price',
        'sale_price',
        'offer_price',
        'price',
        'stock',
        'is_active',
        'seed_type',
        'variety',
        'season',
        'planting_season',
        'packet_weight',
        'germination_time',
        'germination_rate',
        'harvest_time',
        'country_code',
        'related_product_ids',
        'is_featured',
        'is_best_seller',
        'is_new_arrival',
        'is_seasonal',
      ].join(','),
    )
    .eq('country_code', args.country)
    .eq('is_active', true)
    .gt('stock', 0)
    .order('is_featured', { ascending: false })
    .order('is_best_seller', { ascending: false })
    .order('is_new_arrival', { ascending: false })
    .order('stock', { ascending: false })
    .limit(40);

  if (catalogError) throw catalogError;

  const candidates = ((catalog || []) as unknown as (MessengerProduct & {
    related_product_ids?: unknown;
    is_featured?: boolean;
    is_best_seller?: boolean;
    is_new_arrival?: boolean;
    is_seasonal?: boolean;
  })[])
    .filter((product) => !purchasedSet.has(product.id))
    .map((product) => {
      let score = scoreProduct(product, purchasedSet);
      if (product.is_featured) score += 4;
      if (product.is_best_seller) score += 3;
      if (product.is_new_arrival) score += 2;
      if (product.is_seasonal) score += 1;

      return { product, score };
    })
    .sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;

      const aPrice = effectivePrice(a.product) ?? Number.POSITIVE_INFINITY;
      const bPrice = effectivePrice(b.product) ?? Number.POSITIVE_INFINITY;
      if (aPrice !== bPrice) return aPrice - bPrice;

      return productName(a.product).localeCompare(productName(b.product), 'bn');
    })
    .slice(0, limit)
    .map(({ product }) => product);

  const personalized = purchasedIds.length > 0;

  const reply = personalized
    ? '🌱 আপনার আগের Messenger order-এর ভিত্তিতে কিছু related product সাজেস্ট করছি।\n\nবর্তমানে in-stock থাকা পণ্যগুলোই দেখানো হয়েছে।'
    : '🌱 আপনার জন্য কিছু জনপ্রিয় in-stock product সাজেস্ট করছি।\n\nআপনি চাইলে যেকোনো পণ্যের “Order Now” চাপতে পারেন।';

  return {
    reply,
    products: candidates,
    personalized,
  };
}
