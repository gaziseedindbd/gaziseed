import type { Metadata } from 'next';
import { SITE_URL } from '@/lib/seo-metadata';

export const metadata: Metadata = {
  title: 'বাগান গাইড ও চাষাবাদ টিপস | GAZI SEED',
  description:
    'বীজ নির্বাচন, চাষাবাদ, বাগান পরিচর্যা ও কৃষি বিষয়ে ব্যবহারিক বাংলা গাইড ও টিপস — GAZI SEED Garden Guides.',
  alternates: { canonical: `${SITE_URL}/blog` },
  openGraph: {
    title: 'বাগান গাইড ও চাষাবাদ টিপস | GAZI SEED',
    description:
      'বীজ নির্বাচন, চাষাবাদ, বাগান পরিচর্যা ও কৃষি বিষয়ে ব্যবহারিক বাংলা গাইড ও টিপস।',
    url: `${SITE_URL}/blog`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'বাগান গাইড ও চাষাবাদ টিপস | GAZI SEED',
    description:
      'বীজ নির্বাচন, চাষাবাদ, বাগান পরিচর্যা ও কৃষি বিষয়ে ব্যবহারিক বাংলা গাইড ও টিপস।',
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'GAZI SEED Garden Guides',
    description:
      'বীজ নির্বাচন, চাষাবাদ, বাগান পরিচর্যা ও কৃষি বিষয়ে ব্যবহারিক গাইড।',
    url: `${SITE_URL}/blog`,
    inLanguage: ['bn-BD', 'en'],
    isPartOf: {
      '@type': 'WebSite',
      name: 'GAZI SEED',
      url: SITE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  );
}
