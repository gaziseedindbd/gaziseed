'use client';

import { Check, Clock3, Gift, ShoppingCart } from 'lucide-react';

type ProductOfferSpotlightProps = {
  enabled: boolean;
  badge?: string | null;
  badgeEn?: string | null;
  title?: string | null;
  titleEn?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  benefits?: string[] | null;
  benefitsEn?: string[] | null;
  image?: string | null;
  fallbackImage?: string | null;
  ctaText?: string | null;
  ctaTextEn?: string | null;
  ctaLink?: string | null;
  endDate?: string | null;
  note?: string | null;
  noteEn?: string | null;
  lang?: string;
  onPreviewCta?: () => void;
};

function isSafeOfferLink(link?: string | null) {
  if (!link) return false;
  return link.startsWith('/') || /^https:\/\//i.test(link);
}

export default function ProductOfferSpotlight({
  enabled,
  badge,
  badgeEn,
  title,
  titleEn,
  description,
  descriptionEn,
  benefits,
  benefitsEn,
  image,
  fallbackImage,
  ctaText,
  ctaTextEn,
  ctaLink,
  endDate,
  note,
  noteEn,
  lang = 'bn',
  onPreviewCta,
}: ProductOfferSpotlightProps) {
  if (!enabled) return null;

  const expired = !!endDate && new Date(endDate).getTime() <= Date.now();
  if (expired) return null;

  const isEnglish = lang === 'en' || lang === 'hi';
  const resolvedBadge = (isEnglish ? badgeEn : badge) || (isEnglish ? badge : badgeEn) || (isEnglish ? 'SPECIAL OFFER' : 'বিশেষ অফার');
  const resolvedTitle = (isEnglish ? titleEn : title) || (isEnglish ? title : titleEn);
  const resolvedDescription = (isEnglish ? descriptionEn : description) || (isEnglish ? description : descriptionEn);
  const resolvedBenefits = ((isEnglish ? benefitsEn : benefits) || (isEnglish ? benefits : benefitsEn) || []).filter(Boolean);
  const resolvedCtaText = (isEnglish ? ctaTextEn : ctaText) || (isEnglish ? ctaText : ctaTextEn) || (isEnglish ? 'Shop This Offer' : 'অফারটি নিন');
  const resolvedNote = (isEnglish ? noteEn : note) || (isEnglish ? note : noteEn);
  const resolvedImage = image || fallbackImage || null;
  const safeLink = isSafeOfferLink(ctaLink) ? ctaLink : null;

  const handleCta = () => {
    if (safeLink) {
      window.location.href = safeLink;
      return;
    }
    if (onPreviewCta) {
      onPreviewCta();
      return;
    }
    const target = document.getElementById('product-purchase');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section
      className="mb-8 overflow-hidden rounded-[2rem] border border-orange-200/90 bg-gradient-to-r from-amber-50 via-orange-50/80 to-white shadow-[0_18px_50px_-28px_rgba(234,88,12,.35)]"
      aria-label={resolvedBadge}
    >
      <div className="grid items-stretch lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,.65fr)]">
        <div className="relative p-5 sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm">
              <Gift className="h-3.5 w-3.5" />
              {resolvedBadge}
            </span>
            {endDate && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-black text-amber-950">
                <Clock3 className="h-3.5 w-3.5" />
                {isEnglish ? 'LIMITED TIME OFFER' : 'সীমিত সময়ের অফার'}
              </span>
            )}
          </div>

          {resolvedTitle && (
            <h2 className="mt-4 max-w-3xl text-2xl font-black leading-tight text-gray-950 sm:text-3xl lg:text-[2.15rem]">
              {resolvedTitle}
            </h2>
          )}

          {resolvedDescription && (
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-700 sm:text-base">
              {resolvedDescription}
            </p>
          )}

          {resolvedBenefits.length > 0 && (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {resolvedBenefits.slice(0, 6).map((benefit, index) => (
                <div key={index} className="flex items-start gap-2 text-sm font-semibold text-gray-800">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <Check className="h-3 w-3" />
                  </span>
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCta}
              className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
            >
              <ShoppingCart className="h-4 w-4" />
              {resolvedCtaText}
            </button>
            {resolvedNote && (
              <p className="max-w-xl text-[11px] font-semibold text-gray-500">
                • {resolvedNote}
              </p>
            )}
          </div>
        </div>

        <div className="relative min-h-[210px] overflow-hidden bg-gradient-to-br from-orange-100 to-amber-50 lg:min-h-full">
          {resolvedImage ? (
            <img
              src={resolvedImage}
              alt=""
              className="h-full min-h-[210px] w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full min-h-[210px] items-center justify-center p-8 text-center text-sm font-bold text-orange-900/70">
              {isEnglish ? 'Special offer' : 'বিশেষ অফার'}
            </div>
          )}
          <div className="absolute bottom-4 right-4 rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-red-600/30">
            {isEnglish ? 'LIMITED' : 'সীমিত অফার'}
          </div>
        </div>
      </div>
    </section>
  );
}
