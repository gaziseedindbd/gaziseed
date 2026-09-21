'use client';

import { useEffect, useState } from 'react';
import { getVisitorCountry } from '@/lib/supabase/client';
import type { Category, Product, ProductFaq } from '@/lib/supabase/types';

export type HindiTranslations = Record<string, string | string[]>;

type HindiEntity = {
  entity_type: 'product' | 'category' | 'faq';
  id: string;
};

type QueueRequest = {
  item: HindiEntity;
  resolve: (value: HindiTranslationsMap) => void;
};

type HindiTranslationsMap = Record<string, HindiTranslations>;

const pending = new Map<string, Promise<HindiTranslationsMap>>();
let queue: QueueRequest[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function isHindiActive() {
  if (typeof window === 'undefined') return false;
  if (getVisitorCountry() !== 'IN') return false;
  try {
    return localStorage.getItem('gazi_lang_IN') === 'hi';
  } catch {
    return false;
  }
}

function keyOf(item: HindiEntity) {
  return `${item.entity_type}:${item.id}`;
}

async function flushQueue() {
  const batch = queue;
  queue = [];
  flushTimer = null;
  if (batch.length === 0) return;

  const deduped = [...new Map(batch.map((entry) => [keyOf(entry.item), entry.item])).values()];
  const request = fetch('/api/translate-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gazi-country': 'IN' },
    body: JSON.stringify({ items: deduped, target_lang: 'hi' }),
  })
    .then(async (response) => {
      if (!response.ok) return {} as HindiTranslationsMap;
      const payload = await response.json();
      return (payload?.translations || {}) as HindiTranslationsMap;
    })
    .catch(() => ({} as HindiTranslationsMap));

  for (const item of deduped) {
    pending.set(keyOf(item), request);
  }

  const result = await request;
  pending.clear();

  for (const entry of batch) {
    const key = keyOf(entry.item);
    entry.resolve(result[key] ? { [key]: result[key] } : {});
  }
}

export function requestHindiTranslations(items: HindiEntity[]) {
  if (items.length === 0 || !isHindiActive()) {
    return Promise.resolve({} as HindiTranslationsMap);
  }

  const unique = [...new Map(items.map((item) => [keyOf(item), item])).values()];
  return new Promise<HindiTranslationsMap>((resolve) => {
    for (const item of unique) queue.push({ item, resolve });
    if (!flushTimer) {
      flushTimer = setTimeout(() => { void flushQueue(); }, 0);
    }
  }).then((result) => {
    const merged: HindiTranslationsMap = {};
    for (const item of unique) {
      const key = keyOf(item);
      if (result[key]) merged[key] = result[key];
    }
    return merged;
  });
}

export function useHindiEntityTranslation(
  entity: HindiEntity | null,
  enabled: boolean,
) {
  const [translation, setTranslation] = useState<HindiTranslations | null>(null);

  useEffect(() => {
    if (!enabled || !entity || !isHindiActive()) {
      setTranslation(null);
      return;
    }
    let cancelled = false;
    requestHindiTranslations([entity]).then((result) => {
      if (!cancelled) setTranslation(result[keyOf(entity)] || null);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, entity?.entity_type, entity?.id]);

  return translation;
}

export async function hydrateProducts(products: Product[]) {
  if (!isHindiActive() || products.length === 0) return products;
  const result = await requestHindiTranslations(products.map((product) => ({ entity_type: 'product' as const, id: product.id })));
  return products.map((product) => ({
    ...product,
    translations_hi: result[keyOf({ entity_type: 'product', id: product.id })] || null,
  })) as Array<Product & { translations_hi?: HindiTranslations | null }>;
}

export async function hydrateCategories(categories: Category[]) {
  if (!isHindiActive() || categories.length === 0) return categories;
  const result = await requestHindiTranslations(categories.map((category) => ({ entity_type: 'category' as const, id: category.id })));
  return categories.map((category) => ({
    ...category,
    translations_hi: result[keyOf({ entity_type: 'category', id: category.id })] || null,
  })) as Array<Category & { translations_hi?: HindiTranslations | null }>;
}

export async function hydrateFaqs(faqs: ProductFaq[]) {
  if (!isHindiActive() || faqs.length === 0) return faqs;
  const result = await requestHindiTranslations(faqs.map((faq) => ({ entity_type: 'faq' as const, id: faq.id })));
  return faqs.map((faq) => ({
    ...faq,
    translations_hi: result[keyOf({ entity_type: 'faq', id: faq.id })] || null,
  })) as Array<ProductFaq & { translations_hi?: HindiTranslations | null }>;
}
