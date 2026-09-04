import Image from 'next/image';
import Link from 'next/link';

import { getActiveBanners, getActiveCampaigns, getActivePromotionalPopup } from '@/lib/seed-bari/content';
import type { CountryCode } from '@/lib/seed-bari/domain';
import PromotionalPopup from './promotional-popup';

type HomeCmsProps = {
  country: CountryCode;
};

export default async function HomeCms({ country }: HomeCmsProps) {
  const [bannersResult, popupResult, campaignsResult] = await Promise.all([
    getActiveBanners(country),
    getActivePromotionalPopup(country),
    getActiveCampaigns(country),
  ]);

  const banners = bannersResult.data ?? [];
  const popup = popupResult.data;
  const campaigns = campaignsResult.data ?? [];

  return (
    <>
      {banners.length > 0 && (
        <section aria-label="Promotions" className="mb-10 space-y-4">
          {banners.slice(0, 3).map((banner) => (
            <Link key={banner.id} href={banner.link_url || '#'} className="group relative block overflow-hidden rounded-3xl border bg-white shadow-sm">
              <div className="relative aspect-[5/1] min-h-32 w-full bg-[#edf5e9]">
                <Image src={banner.image_url} alt={banner.title || 'SEED BARI promotion'} fill sizes="(max-width: 768px) 100vw, 1200px" className="object-cover transition duration-300 group-hover:scale-[1.01]" />
              </div>
              {banner.title && <div className="absolute inset-x-0 bottom-0 bg-black/45 px-5 py-3 text-white backdrop-blur-sm"><p className="font-bold">{banner.title}</p></div>}
            </Link>
          ))}
        </section>
      )}

      {campaigns.length > 0 && (
        <section className="mb-10 rounded-3xl border bg-white p-6 md:p-8">
          <div className="mb-5">
            <p className="text-sm font-bold tracking-wider text-[#1f6b3b]">ACTIVE CAMPAIGNS</p>
            <h2 className="mt-1 text-2xl font-black md:text-3xl">Current SEED BARI campaigns</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.slice(0, 6).map((campaign) => (
              <Link key={campaign.id} href={campaign.landing_page_id ? `/landing/${campaign.campaign_code || campaign.id}` : '/shop'} className="rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{campaign.platform || 'SEED BARI'}</p>
                <h3 className="mt-2 font-black">{campaign.name}</h3>
                {campaign.source && <p className="mt-2 text-sm text-gray-600">Campaign: {campaign.source}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {popup && <PromotionalPopup popup={popup} />}
    </>
  );
}
