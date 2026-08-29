import { redirect } from 'next/navigation';

type Props = {
  params: Promise<{ slug: string; channel: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdsLandingChannelRedirect({ params, searchParams }: Props) {
  const { slug, channel } = await params;
  const incoming = await searchParams;
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(incoming)) {
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, item));
    } else if (value != null) {
      query.set(key, value);
    }
  }

  // Keep the channel from the Ads URL as the tracking source unless the
  // caller already supplied an explicit UTM source.
  if (!query.has('utm_source')) query.set('utm_source', channel);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  redirect(`/offer/${encodeURIComponent(slug)}${suffix}`);
}
