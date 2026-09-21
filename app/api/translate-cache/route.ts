import { createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

type EntityType = 'product' | 'category' | 'faq' | 'banner' | 'service' | 'testimonial' | 'blog' | 'combo' | 'variant' | 'bundle' | 'promotion' | 'delivery_zone';

type EntityRequest = {
  entity_type: EntityType;
  id: string;
};

type TranslationSource = {
  entity_type: EntityType;
  id: string;
  source: Record<string, string | string[]>;
  hash: string;
};

const MAX_ITEMS = 20;
const MAX_GOOGLE_ITEMS = 128;
const TARGET_LANG = 'hi';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

function getAdminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Server Supabase credentials are not configured.');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hashSource(source: Record<string, string | string[]>) {
  return createHash('sha256').update(JSON.stringify(source)).digest('hex');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [];
}

function buildProductSource(row: any): Record<string, string | string[]> {
  return {
    name: text(row.name_en) || text(row.name_bn),
    short_description: text(row.short_description),
    description: text(row.description),
    seed_type: text(row.seed_type),
    variety: text(row.variety),
    brand: text(row.brand),
    origin: text(row.origin),
    season: text(row.season),
    planting_season: text(row.planting_season),
    germination_time: text(row.germination_time),
    germination_rate: text(row.germination_rate),
    harvest_time: text(row.harvest_time),
    plant_spacing: text(row.plant_spacing),
    planting_depth: text(row.planting_depth),
    sunlight: text(row.sunlight),
    water_requirement: text(row.water_requirement),
    soil_type: text(row.soil_type),
    growing_location: text(row.growing_location),
    packet_weight: text(row.packet_weight),
    seed_quantity: text(row.seed_quantity),
    expected_yield: text(row.expected_yield),
    cultivation_instructions: text(row.cultivation_instructions),
    storage_instructions: text(row.storage_instructions),
    features: stringArray(row.features),
    benefits: stringArray(row.benefits),
    seo_title: text(row.seo_title),
    meta_description: text(row.meta_description),
    image_alt: text(row.image_alt) || text(row.image_alt_bn),
  };
}

function buildCategorySource(row: any): Record<string, string | string[]> {
  return {
    name: text(row.name_en) || text(row.name_bn),
    description: text(row.description),
    seo_title: text(row.seo_title),
    meta_description: text(row.meta_description),
  };
}

function buildFaqSource(row: any): Record<string, string | string[]> {
  return {
    question: text(row.question_en) || text(row.question_bn),
    answer: text(row.answer_en) || text(row.answer_bn),
  };
}

function buildBannerSource(row: any): Record<string, string | string[]> {
  return {
    title: text(row.title),
    subtitle: text(row.subtitle),
    cta_text: text(row.cta_text),
  };
}

function buildServiceSource(row: any): Record<string, string | string[]> {
  return {
    title: text(row.title),
    short_description: text(row.short_description),
    full_description: text(row.full_description),
    cta_text: text(row.cta_text),
  };
}

function buildTestimonialSource(row: any): Record<string, string | string[]> {
  return {
    review: text(row.review),
  };
}

function buildBlogSource(row: any): Record<string, string | string[]> {
  return {
    title: text(row.title),
    content: text(row.content),
    category: text(row.category),
    seo_title: text(row.seo_title),
    meta_description: text(row.meta_description),
  };
}

function buildComboSource(row: any): Record<string, string | string[]> {
  return {
    title: text(row.title_en) || text(row.name_en) || text(row.title_bn) || text(row.name_bn) || text(row.title) || text(row.name),
    description: text(row.description_en) || text(row.description_bn) || text(row.description),
    subtitle: text(row.subtitle),
    manual_items_list: text(row.manual_items_list),
    seo_title: text(row.seo_title),
    meta_description: text(row.meta_description),
  };
}

function buildVariantSource(row: any): Record<string, string | string[]> {
  return {
    name: text(row.name),
    weight_or_count: text(row.weight_or_count),
  };
}

function buildBundleSource(row: any): Record<string, string | string[]> {
  return {
    bundle_name: text(row.bundle_name),
    savings: text(row.savings),
    badge: text(row.badge),
  };
}

function buildPromotionSource(row: any): Record<string, string | string[]> {
  return {
    title: text(row.title),
    subtitle: text(row.subtitle),
    description: text(row.description),
    cta_text: text(row.cta_text),
    name: text(row.name),
    eligibility: text(row.eligibility),
    gift_mode: text(row.gift_mode),
  };
}

function buildDeliveryZoneSource(row: any): Record<string, string | string[]> {
  return {
    zone_name: text(row.zone_name),
    estimated_time: text(row.estimated_time),
  };
}

function buildSource(entityType: EntityType, row: any): Record<string, string | string[]> {
  if (entityType === 'product') return buildProductSource(row);
  if (entityType === 'category') return buildCategorySource(row);
  if (entityType === 'faq') return buildFaqSource(row);
  if (entityType === 'banner') return buildBannerSource(row);
  if (entityType === 'service') return buildServiceSource(row);
  if (entityType === 'testimonial') return buildTestimonialSource(row);
  if (entityType === 'blog') return buildBlogSource(row);
  if (entityType === 'combo') return buildComboSource(row);
  if (entityType === 'variant') return buildVariantSource(row);
  if (entityType === 'bundle') return buildBundleSource(row);
  if (entityType === 'promotion') return buildPromotionSource(row);
  return buildDeliveryZoneSource(row);
}

async function fetchEntityRows(
  supabase: ReturnType<typeof getAdminClient>,
  entityType: EntityType,
  ids: string[],
) {
  if (entityType === 'product') {
    const { data, error } = await supabase
      .from('products')
      .select('id,country_code,is_active,is_ads_only,name_bn,name_en,short_description,description,seed_type,variety,brand,origin,season,planting_season,germination_time,germination_rate,harvest_time,plant_spacing,planting_depth,sunlight,water_requirement,soil_type,growing_location,packet_weight,seed_quantity,expected_yield,cultivation_instructions,storage_instructions,features,benefits,seo_title,meta_description,image_alt,image_alt_bn')
      .in('id', ids)
      .eq('country_code', 'IN')
      .eq('is_active', true)
      .eq('is_ads_only', false);
    if (error) throw error;
    return new Map((data || []).map((row) => [row.id, row]));
  }

  const simpleTables: Record<Exclude<EntityType, 'product' | 'category' | 'faq' | 'variant'>, string> = {
    banner: 'banners',
    service: 'services',
    testimonial: 'testimonials',
    blog: 'blog_posts',
    combo: 'combo_packs',
    bundle: 'bundle_offers',
    promotion: 'promotions',
    delivery_zone: 'delivery_zones',
  };

  if (entityType === 'category') {
    const { data, error } = await supabase
      .from('categories')
      .select('id,country_code,is_active,name_bn,name_en,description,seo_title,meta_description')
      .in('id', ids)
      .eq('country_code', 'IN')
      .eq('is_active', true);
    if (error) throw error;
    return new Map((data || []).map((row) => [row.id, row]));
  }

  if (entityType === 'faq') {
    const { data, error } = await supabase
      .from('product_faqs')
      .select('id,product_id,is_active,question_bn,answer_bn,question_en,answer_en')
      .in('id', ids)
      .eq('is_active', true);
    if (error) throw error;

    const productIds = [...new Set((data || []).map((row) => row.product_id).filter(Boolean))];
    if (productIds.length === 0) return new Map();

    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id')
      .in('id', productIds)
      .eq('country_code', 'IN')
      .eq('is_active', true)
      .eq('is_ads_only', false);
    if (productError) throw productError;

    const allowed = new Set((products || []).map((row) => row.id));
    return new Map((data || []).filter((row) => allowed.has(row.product_id)).map((row) => [row.id, row]));
  }

  if (entityType === 'variant') {
    const { data, error } = await supabase
      .from('product_variants')
      .select('id,product_id,is_active,name,weight_or_count')
      .in('id', ids)
      .eq('is_active', true);
    if (error) throw error;

    const productIds = [...new Set((data || []).map((row) => row.product_id).filter(Boolean))];
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id')
      .in('id', productIds)
      .eq('country_code', 'IN')
      .eq('is_active', true)
      .eq('is_ads_only', false);
    if (productError) throw productError;

    const allowed = new Set((products || []).map((row) => row.id));
    return new Map((data || []).filter((row) => allowed.has(row.product_id)).map((row) => [row.id, row]));
  }

  const table = simpleTables[entityType as keyof typeof simpleTables];
  if (!table) return new Map();

  const { data, error } = await supabase
    .from(table)
    .select('*')
    .in('id', ids)
    .eq('country_code', 'IN')
    .eq('is_active', true);
  if (error) throw error;
  return new Map((data || []).map((row: any) => [row.id, row]));
}

async function translateBatch(values: string[]) {
  if (values.length === 0) return [];
  if (!GOOGLE_TRANSLATE_API_KEY) {
    throw new Error('GOOGLE_TRANSLATE_API_KEY is not configured.');
  }

  const translated: string[] = [];
  for (let index = 0; index < values.length; index += MAX_GOOGLE_ITEMS) {
    const chunk = values.slice(index, index + MAX_GOOGLE_ITEMS);
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(GOOGLE_TRANSLATE_API_KEY)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: chunk,
          target: TARGET_LANG,
          format: 'text',
        }),
        cache: 'no-store',
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google Translation API failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    const payload = await response.json();
    const result = payload?.data?.translations;
    if (!Array.isArray(result) || result.length !== chunk.length) {
      throw new Error('Google Translation API returned an unexpected response.');
    }
    translated.push(...result.map((item: any) => String(item.translatedText ?? '')));
  }

  return translated;
}

function buildTranslatedPayload(
  source: Record<string, string | string[]>,
  translations: string[],
) {
  const payload: Record<string, string | string[]> = {};
  let cursor = 0;

  for (const [field, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      const translatedArray = value.map(() => translations[cursor++] ?? '');
      payload[field] = translatedArray;
    } else if (value) {
      payload[field] = translations[cursor++] ?? '';
    } else {
      payload[field] = value;
    }
  }

  return payload;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = Array.isArray(body?.items) ? body.items as EntityRequest[] : [];
    const targetLang = String(body?.target_lang || '').toLowerCase();

    if (targetLang !== TARGET_LANG) {
      return NextResponse.json({ error: 'Only Hindi translation is supported by this endpoint.' }, { status: 400 });
    }

    if (items.length < 1 || items.length > MAX_ITEMS) {
      return NextResponse.json({ error: `Provide 1-${MAX_ITEMS} translation items.` }, { status: 400 });
    }

    const deduped = new Map<string, EntityRequest>();
    for (const item of items) {
      if (!item || !['product', 'category', 'faq', 'banner', 'service', 'testimonial', 'blog', 'combo', 'variant', 'bundle', 'promotion', 'delivery_zone'].includes(item.entity_type) || typeof item.id !== 'string') continue;
      deduped.set(`${item.entity_type}:${item.id}`, item);
    }

    if (deduped.size === 0) {
      return NextResponse.json({ translations: {} });
    }

    const supabase = getAdminClient();
    const grouped = new Map<EntityType, string[]>();

    for (const item of deduped.values()) {
      const ids = grouped.get(item.entity_type) || [];
      ids.push(item.id);
      grouped.set(item.entity_type, ids);
    }

    const sources: TranslationSource[] = [];
    for (const [entityType, ids] of grouped.entries()) {
      const rows = await fetchEntityRows(supabase, entityType, ids);
      for (const id of ids) {
        const row = rows.get(id);
        if (!row) continue;
        const source = buildSource(entityType, row);
        const hash = hashSource(source);
        sources.push({ entity_type: entityType, id, source, hash });
      }
    }

    const cacheIds = sources.map((item) => item.id);
    const { data: cachedRows, error: cacheError } = await supabase
      .from('translation_cache')
      .select('entity_type,entity_id,target_lang,source_hash,translated_payload')
      .eq('target_lang', TARGET_LANG)
      .in('entity_id', cacheIds);

    if (cacheError) throw cacheError;

    const cacheMap = new Map(
      (cachedRows || []).map((row) => [`${row.entity_type}:${row.entity_id}`, row]),
    );

    const responseTranslations: Record<string, Record<string, string | string[]>> = {};
    const missing: TranslationSource[] = [];

    for (const item of sources) {
      const key = `${item.entity_type}:${item.id}`;
      const cached = cacheMap.get(key);
      if (cached?.source_hash === item.hash && cached?.translated_payload) {
        responseTranslations[key] = cached.translated_payload;
      } else {
        missing.push(item);
      }
    }

    if (missing.length > 0) {
      const units: { item: TranslationSource; field: string; index: number | null; value: string }[] = [];
      for (const item of missing) {
        for (const [field, value] of Object.entries(item.source)) {
          if (Array.isArray(value)) {
            value.forEach((entry, index) => {
              if (entry) units.push({ item, field, index, value: entry });
            });
          } else if (value) {
            units.push({ item, field, index: null, value });
          }
        }
      }

      const translatedStrings = await translateBatch(units.map((unit) => unit.value));
      const payloadMap = new Map<string, Record<string, string | string[]>>();

      missing.forEach((item) => payloadMap.set(`${item.entity_type}:${item.id}`, {}));

      units.forEach((unit, index) => {
        const key = `${unit.item.entity_type}:${unit.item.id}`;
        const payload = payloadMap.get(key)!;
        const original = unit.item.source[unit.field];
        if (Array.isArray(original)) {
          const existing = Array.isArray(payload[unit.field]) ? [...payload[unit.field] as string[]] : new Array(original.length).fill('');
          existing[unit.index!] = translatedStrings[index] || '';
          payload[unit.field] = existing;
        } else {
          payload[unit.field] = translatedStrings[index] || '';
        }
      });

      for (const item of missing) {
        const key = `${item.entity_type}:${item.id}`;
        const payload = payloadMap.get(key)!;

        for (const [field, value] of Object.entries(item.source)) {
          if (!(field in payload)) payload[field] = value;
        }

        const { error: upsertError } = await supabase
          .from('translation_cache')
          .upsert({
            entity_type: item.entity_type,
            entity_id: item.id,
            target_lang: TARGET_LANG,
            source_hash: item.hash,
            translated_payload: payload,
            provider: 'google-cloud-translation',
          }, { onConflict: 'entity_type,entity_id,target_lang' });

        if (upsertError) throw upsertError;
        responseTranslations[key] = payload;
      }
    }

    return NextResponse.json(
      { translations: responseTranslations, provider: 'google-cloud-translation' },
      {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Translation request failed.',
      },
      { status: 500 },
    );
  }
}
