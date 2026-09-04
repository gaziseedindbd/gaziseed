import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const MODULES = [
  ['Banners', 'banners', 'Manage desktop/mobile storefront banners', '/admin/cms/banners'],
  ['Promotional Popups', 'promotional_popups', 'Schedule offers and CTA popups', '/admin/cms/popups'],
  ['Landing Pages', 'landing_pages', 'Manage campaign and ad landing pages', '/admin/cms/landing-pages'],
  ['Campaigns', 'campaigns', 'Track campaigns, sources and landing pages', '/admin/cms/campaigns'],
  ['Content Pages', 'content_pages', 'Manage About, policy and information pages', '/admin/cms/pages'],
  ['Blog', 'blog_posts', 'Publish SEO-friendly articles', '/admin/cms/blog'],
  ['Guides', 'guides', 'Publish growing and cultivation guides', '/admin/cms/guides'],
  ['Video Gallery', 'video_gallery', 'Manage YouTube content', '/admin/cms/videos'],
  ['Free Gift Promotions', 'free_gift_promotions', 'Configure threshold gift promotions', '/admin/cms/free-gifts'],
] as const;

export default async function CmsHubPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', (await supabase.auth.getUser()).data.user?.id ?? '').maybeSingle();
  if (profile?.role !== 'master_admin') {
    return <main className="p-5 md:p-8"><h1 className="text-3xl font-black">CMS & Marketing</h1><p className="mt-3 text-red-600">Master Admin access required.</p></main>;
  }

  const counts = await Promise.all(MODULES.map(async ([, table]) => {
    const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
    return [table, count ?? 0] as const;
  }));
  const countMap = Object.fromEntries(counts);

  return (
    <main className="p-5 md:p-8">
      <div className="max-w-6xl">
        <p className="font-bold text-[#1f6b3b]">SEED BARI</p>
        <h1 className="mt-1 text-3xl font-black">CMS & Marketing</h1>
        <p className="mt-2 text-gray-500">Central control for storefront content, landing pages and campaigns.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(([label, table, description, href]) => (
            <Link key={table} href={href} className="rounded-2xl border bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-black">{label}</h2>
                <span className="rounded-full bg-[#edf5e9] px-3 py-1 text-sm font-bold text-[#1f6b3b]">{countMap[table]}</span>
              </div>
              <p className="mt-3 text-sm text-gray-500">{description}</p>
              <span className="mt-5 inline-block font-bold text-[#1f6b3b]">Open →</span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
