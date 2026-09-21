'use client';

import { useEffect, useState } from 'react';
import { getVisitorCountry } from '@/lib/supabase/client';
import type { Category, Product, ProductFaq } from '@/lib/supabase/types';

export type HindiTranslations = Record<string, string | string[]>;

type HindiEntity = {
  entity_type: 'product' | 'category' | 'faq';
  id: string;
};

const pending = new Map<string, Promise<Record<string, HindiTranslations>>>();
let queue: HindiEntity[] = [];
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

function flushQueue() {
  const batch = queue;
  queue = [];
  flushTimer = null;
  if (batch.length === 0) return;

  const deduped = [...new Map(batch.map((item) => [keyOf(item), item])).values()];
  const request = fetch('/api/translate-cache', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-gazi-country': 'IN' },
    body: JSON.stringify({ items: deduped, target_lang: 'hi' }),
  })
    .then(async (response) => {
      if (!response.ok) return {};
      const payload = await response.json();
      return (payload?.translations || {}) as Record<string, HindiTranslations>;
    })
    .catch(() => ({}));

  for (const item of deduped) {
    pending.set(keyOf(item), request);
  }
}

export function requestHindiTranslations(items: HindiEntity[]) {
  if (items.length === 0 || !isHindiActive()) {
    return Promise.resolve({} as Record<string, HindiTranslations>);
  }

  for (const item of items) {
    queue.push(item);
  }
  if (!flushTimer) {
    flushTimer = setTimeout(flushQueue, 0);
  }

  return new Promise<Record<string, HindiTranslations>>((resolve) => {
    const run = () => {
      requestHindiTranslationsOnce(items).then(resolve);
    };
    queueMicrotask(run);
  });
}

async function requestHindiTranslationsOnce(items: HindiEntity[]) {
  const unique = [...new Map(items.map((item) => [keyOf(item), item])).values()];
  const results: Record<string, HindiTranslations> = {};

  for (const item of unique) {
    const existing = pending.get(keyOf(item));
    if (existing) {
      const response = await existing;
      if (response[keyOf(item)]) results[keyOf(item)] = response[keyOf(item)];
      pending.delete(keyOf(item));
    }
  }

  return results;
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
