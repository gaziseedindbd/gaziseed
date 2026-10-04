'use client';

import { Check, Clock3, Gift, ShoppingCart } from 'lucide-react';

type ProductOfferSpotlightProps = {
  enabled: boolean;
  badge?: string | null;
  badgeEn?: string | null;
  badgeHi?: string | null;
  title?: string | null;
  titleEn?: string | null;
  titleHi?: string | null;
  description?: string | null;
  descriptionEn?: string | null;
  descriptionHi?: string | null;
  benefits?: string[] | null;
  benefitsEn?: string[] | null;
  benefitsHi?: string[] | null;
  image?: string | null;
  imageEn?: string | null;
  imageHi?: string | null;
  fallbackImage?: string | null;
  ctaText?: string | null;
  ctaTextEn?: string | null;
  ctaTextHi?: string | null;
  ctaLink?: string | null;
  endDate?: string | null;
  note?: string | null;
  noteEn?: string | null;
  noteHi?: string | null;
  lang?: string;
  onPreviewCta?: () => void;
  preview?: boolean;
};

function isSafeOfferLink(link?: string | null) {
  if (!link) return false;
  return link.startsWith('/') || /^https:\/\//i.test(link);
}

export default function ProductOfferSpotlight({
  enabled,
  badge,
  badgeEn,
  badgeHi,
  title,
  titleEn,
  titleHi,
  description,
  descriptionEn,
  descriptionHi,
  benefits,
  benefitsEn,
  benefitsHi,
  image,
  imageEn,
  imageHi,
  fallbackImage,
  ctaText,
  ctaTextEn,
  ctaTextHi,
  ctaLink,
  endDate,
  note,
  noteEn,
  noteHi,
  lang = 'bn',
  onPreviewCta,
  preview = false,
}: ProductOfferSpotlightProps) {
  if (!enabled) return null;

  const expired = !!endDate && new Date(endDate).getTime() <= Date.now();
  if (expired) return null;

  const normalizedLang = lang === 'hi' ? 'hi' : lang === 'en' ? 'en' : 'bn';
  const isEnglish = normalizedLang === 'en';
  const isHindi = normalizedLang === 'hi';

  const resolvedBadge =
    (isHindi ? badgeHi : isEnglish ? badgeEn : badge) ||
    (isHindi ? badgeEn : isEnglish ? badge : badgeHi) ||
    badge ||
    badgeEn ||
    badgeHi ||
    (isHindi ? 'विशेष ऑफ़र' : isEnglish ? 'SPECIAL OFFER' : 'বিশেষ অফার');

  const resolvedTitle =
    (isHindi ? titleHi : isEnglish ? titleEn : title) ||
    (isHindi ? titleEn : isEnglish ? title : titleHi) ||
    title ||
    titleEn ||
    titleHi;

  const resolvedDescription =
    (isHindi ? descriptionHi : isEnglish ? descriptionEn : description) ||
    (isHindi ? descriptionEn : isEnglish ? description : descriptionHi) ||
    description ||
    descriptionEn ||
    descriptionHi;

  const resolvedBenefits = (
    (isHindi ? benefitsHi : isEnglish ? benefitsEn : benefits) ||
    (isHindi ? benefitsEn : isEnglish ? benefits : benefitsHi) ||
    benefits ||
    benefitsEn ||
    benefitsHi ||
    []
  ).filter(Boolean);

  const resolvedCtaText =
    (isHindi ? ctaTextHi : isEnglish ? ctaTextEn : ctaText) ||
    (isHindi ? ctaTextEn : isEnglish ? ctaText : ctaTextHi) ||
    ctaText ||
    ctaTextEn ||
    ctaTextHi ||
    (isHindi ? 'ऑफ़र लें' : isEnglish ? 'Shop This Offer' : 'অফারটি নিন');

  const resolvedNote =
    (isHindi ? noteHi : isEnglish ? noteEn : note) ||
    (isHindi ? noteEn : isEnglish ? note : noteHi) ||
    note ||
    noteEn ||
    noteHi;

  const resolvedImage =
    (isHindi ? imageHi : isEnglish ? imageEn : image) ||
    (isHindi ? imageEn : isEnglish ? image : imageHi) ||
    image ||
    imageEn ||
    imageHi ||
    fallbackImage ||
    null;

  const safeLink = isSafeOfferLink(ctaLink);

  const handleCta = () => {
    if (preview) return;
    if (safeLink) {
      window.location.href = ctaLink as string;
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
    <>
      <style jsx>{`
        @keyframes offerTextFloat {
          0%, 100% { transform: translateY(0); opacity: 1; }
          50% { transform: translateY(-2px); opacity: .97; }
        }
        .offer-text-animate {
          animation: offerTextFloat 4.8s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .offer-text-animate { animation: none; }
        }
      `}</style>

      <section
        className="mb-8 overflow-hidden rounded-[2rem] border border-orange-200/90 bg-gradient-to-r from-amber-50 via-orange-50/80 to-white shadow-[0_18px_50px_-28px_rgba(234,88,12,.35)]"
        aria-label={resolvedBadge}
      >
        <div className="grid items-start lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,.65fr)]">
          <div className="relative p-5 sm:p-7 lg:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="offer-text-animate inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-white shadow-sm">
                <Gift className="h-3.5 w-3.5" />
                {resolvedBadge}
              </span>
              {endDate && (
                <span className="offer-text-animate inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-black text-amber-950">
                  <Clock3 className="h-3.5 w-3.5" />
                  {isHindi ? 'सीमित समय ऑफ़र' : isEnglish ? 'LIMITED TIME OFFER' : 'সীমিত সময়ের অফার'}
                </span>
              )}
            </div>

            {resolvedTitle && (
              <h2 className="offer-text-animate mt-4 max-w-3xl text-2xl font-black leading-tight text-gray-950 sm:text-3xl lg:text-[2.15rem]">
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
                disabled={preview}
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-600/20 transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-70"
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

          <div className="relative w-full max-h-[480px] overflow-hidden bg-gradient-to-br from-orange-100 to-amber-50 aspect-[4/5] lg:max-h-[520px]">
            {resolvedImage ? (
              <img
                src={resolvedImage}
                alt=""
                className="block h-full w-full object-contain object-center"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center p-8 text-center text-sm font-bold text-orange-900/70">
                {isHindi ? 'विशेष ऑफ़र' : isEnglish ? 'Special offer' : 'বিশেষ অফার'}
              </div>
            )}
            <div className="absolute bottom-4 right-4 rounded-full bg-red-600 px-4 py-2 text-xs font-black text-white shadow-lg shadow-red-600/30">
              {isHindi ? 'सीমিত অফ़र' : isEnglish ? 'LIMITED' : 'সীমিত অফার'}
            </div>
          </div>
</div>
        </div>
      </section>
    </>
  );
}
