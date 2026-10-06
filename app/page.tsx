import { createServerSupabase } from '@/lib/supabase/server';
import Home from '@/components/site/home';
import type { Banner } from '@/lib/supabase/types';

export const revalidate = 60;

export default async function Page() {
  const supabase = await createServerSupabase();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('banners')
    .select('*')
    .eq('is_active', true)
    .or(`start_date.is.null,start_date.lte.${now}`)
    .or(`end_date.is.null,end_date.gte.${now}`)
    .order('display_order', { ascending: true });

  const initialBanners = (data || []) as Banner[];
  return <Home initialBanners={initialBanners} />;
}
