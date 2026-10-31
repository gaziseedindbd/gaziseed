export type VisitorCountry = 'BD' | 'IN';

export function normalizeVisitorCountry(value: string | null | undefined): VisitorCountry | null {
  const country = value?.trim().toUpperCase();
  return country === 'IN' || country === 'BD' ? country : null;
}

export function getPathVisitorCountry(pathname: string): VisitorCountry | null {
  const productMatch = pathname.match(/^\/(in|bd)\/product(?:\/|$)/i);
  if (productMatch?.[1]?.toUpperCase() === 'IN') return 'IN';
  if (productMatch?.[1]?.toUpperCase() === 'BD') return 'BD';
  if (/^\/india(?:\/|$)/i.test(pathname)) return 'IN';
  const categorySlug = pathname.match(/^\/category\/([^/]+)\/?$/i)?.[1]?.toLowerCase();
  if (categorySlug?.endsWith('-in') || categorySlug?.endsWith('-india')) return 'IN';
  if (categorySlug?.endsWith('-bd')) return 'BD';
  return null;
}

export function resolveVisitorCountry(input: {
  pathname: string;
  manualOverride?: string | null;
  vercelCountry?: string | null;
  cloudflareCountry?: string | null;
}): VisitorCountry {
  const routeCountry = getPathVisitorCountry(input.pathname);
  if (routeCountry) return routeCountry;

  const manualCountry = normalizeVisitorCountry(input.manualOverride);
  if (manualCountry) return manualCountry;

  const detectedCountry = normalizeVisitorCountry(input.vercelCountry) || normalizeVisitorCountry(input.cloudflareCountry);
  return detectedCountry || 'BD';
}
