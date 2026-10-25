export const META_CAPI_ORDER_SOURCES = [
  'website',
  'ads',
  'facebook',
  'instagram',
  'google',
  'tiktok',
  'animated_landing',
  'combo',
] as const;

const META_CAPI_ORDER_SOURCE_SET = new Set<string>(META_CAPI_ORDER_SOURCES);

export function isMetaCapiOrderSource(value: string | null | undefined): boolean {
  return typeof value === 'string' && META_CAPI_ORDER_SOURCE_SET.has(value);
}
