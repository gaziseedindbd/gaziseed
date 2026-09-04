import Image from 'next/image';
import Link from 'next/link';

import {
  getActiveBanners,
  getActiveCampaigns,
  getActiveGuides,
  getActiveLandingPage,
  getActivePromotionalPopup,
  getActiveVideos,
  getPublishedBlogPosts,
} from '@/lib/seed-bari/content';
import type { CountryCode } from '@/lib/seed-bari/domain';
import PromotionalPopup from './promotional-popup';

type HomeCmsProps = {
  country: CountryCode;
};

function excerpt(value: string | null | undefined, maxLength = 150) {
  const text = (value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export default async function HomeCms({ country }: HomeCmsProps) {
  const [bannersResult, popupResult, campaignsResult, blogResult, guidesResult, videosResult] =
    await Promise.all([
      getActiveBanners(country),
      getActivePromotionalPopup(country),
      getActiveCampaigns(country),
      getPublishedBlogPosts(country, 3),
      getActiveGuides(country, 3),
      getActiveVideos(country, 3),
    ]);

  const banners = bannersResult.data ?? [];
  const popup = popupResult.data;
  const campaigns = campaignsResult.data ?? [];
  const blogPosts = blogResult.data ?? [];
  const guides = guidesResult.data ?? [];
  const videos = videosResult.data ?? [];

  const campaignLandingPages = Object.fromEntries(
    campaigns
      .filter((campaign) => campaign.landing_page_id)
      .map((campaign) => [campaign.landing_page_id as string, getActiveLandingPage(country, campaign.landing_page_id as string)])
  );
  const landingResults = await Promise.all(Object.values(campaignLandingPages));
  const landingPageSlugs = Object.fromEntries(
    Object.keys(campaignLandingPages).map((id, index) => [id, landingResults[index]?.data?.slug ?? null])
  );

  return (
    <>
      {banners.length > 0 && (
        <section aria-label="Promotions" className="mb-10 space-y-4">
          {banners.slice(0, 3).map((banner) => (
            <Link
              key={banner.id}
              href={banner.link_url || '#'}
              className="group relative block overflow-hidden rounded-3xl border bg-white shadow-sm"
            >
              <div className="relative aspect-[5/1] min-h-32 w-full bg-[#edf5e9]">
                <Image
                  src={banner.image_url}
                  alt={banner.title || 'SEED BARI promotion'}
                  fill
                  sizes="(max-width: 768px) 100vw, 1200px"
                  className="object-cover transition duration-300 group-hover:scale-[1.01]"
                />
              </div>
              {banner.title && (
                <div className="absolute inset-x-0 bottom-0 bg-black/45 px-5 py-3 text-white backdrop-blur-sm">
                  <p className="font-bold">{banner.title}</p>
                </div>
              )}
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
            {campaigns.slice(0, 6).map((campaign) => {
              const landingSlug = campaign.landing_page_id
                ? landingPageSlugs[campaign.landing_page_id] ?? null
                : null;
              const href = landingSlug ? `/landing/${landingSlug}` : '/shop';

              return (
                <Link
                  key={campaign.id}
                  href={href}
                  className="rounded-2xl border p-5 transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <p className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    {campaign.platform || 'SEED BARI'}
                  </p>
                  <h3 className="mt-2 font-black">{campaign.name}</h3>
                  {campaign.source && <p className="mt-2 text-sm text-gray-600">Campaign: {campaign.source}</p>}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {(blogPosts.length > 0 || guides.length > 0 || videos.length > 0) && (
        <section className="mb-10 space-y-10">
          {blogPosts.length > 0 && (
            <div>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold tracking-wider text-[#1f6b3b]">FROM THE BLOG</p>
                  <h2 className="mt-1 text-2xl font-black md:text-3xl">Seed growing tips & stories</h2>
                </div>
                <Link href="/blog" className="font-bold text-[#1f6b3b]">View all →</Link>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                {blogPosts.map((post) => (
                  <Link key={post.id} href={`/blog/${post.slug}`} className="overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg">
                    {post.cover_image_url ? (
                      <div className="relative h-44 bg-[#edf5e9]">
                        <img src={post.cover_image_url} alt={post.title_en || post.title_bn} className="h-full w-full object-cover" />
                      </div>
                    ) : null}
                    <div className="p-5">
                      <h3 className="font-black">{post.title_en || post.title_bn}</h3>
                      <p className="mt-2 text-sm text-gray-600">{excerpt(post.excerpt || post.title_bn || post.title_en)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {guides.length > 0 && (
            <div>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold tracking-wider text-[#1f6b3b]">GROWING GUIDES</p>
                  <h2 className="mt-1 text-2xl font-black md:text-3xl">Practical cultivation guides</h2>
                </div>
                <Link href="/guides" className="font-bold text-[#1f6b3b]">View all →</Link>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                {guides.map((guide) => (
                  <Link key={guide.id} href={`/guides/${guide.slug}`} className="rounded-2xl border bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg">
                    <h3 className="font-black">{guide.title_en || guide.title_bn}</h3>
                    <p className="mt-2 text-sm text-gray-600">{excerpt(guide.content_en || guide.content_bn)}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {videos.length > 0 && (
            <div>
              <div className="mb-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold tracking-wider text-[#1f6b3b]">VIDEO GALLERY</p>
                  <h2 className="mt-1 text-2xl font-black md:text-3xl">Learn from SEED BARI videos</h2>
                </div>
                <Link href="/videos" className="font-bold text-[#1f6b3b]">View all →</Link>
              </div>
              <div className="grid gap-5 md:grid-cols-3">
                {videos.map((video) => (
                  <a
                    key={video.id}
                    href={video.youtube_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl border bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg"
                  >
                    <div className="flex h-36 items-center justify-center rounded-xl bg-[#edf5e9] text-4xl">▶</div>
                    <h3 className="mt-4 font-black">{video.title}</h3>
                    {video.description && <p className="mt-2 text-sm text-gray-600">{excerpt(video.description)}</p>}
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {popup && <PromotionalPopup popup={popup} />}
    </>
  );
}
