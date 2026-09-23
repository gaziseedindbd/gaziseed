export const revalidate = 60;

import Home from '@/components/site/home';
import type { Banner } from '@/lib/supabase/types';

async function getInitialBanners(): Promise<Banner[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufxsthshyebahkwbmioe.supabase.co';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_vCaz5OGrHocUTgpOXmE9xg_QVsuUJc0';
  try {
    const res = await fetch(
      url + '/rest/v1/banners?select=*&is_active=eq.true&order=display_order.asc',
      { headers: { apikey: key, Authorization: 'Bearer ' + key }, next: { revalidate: 60 } }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Banner[];
    const now = Date.now();
    return rows.filter((banner) => {
      const start = banner.start_date ? Date.parse(banner.start_date) : NaN;
      const end = banner.end_date ? Date.parse(banner.end_date) : NaN;
      return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || end >= now);
    });
  } catch {
    return [];
  }
}

export default async function Page() {
  const initialBanners = await getInitialBanners();
  return <Home initialBanners={initialBanners} />;
}
