import Link from 'next/link';
import type { Metadata } from 'next';

import { getPublishedBlogPosts } from '@/lib/seed-bari/content';
import { getStoreCountry } from '@/lib/seed-bari/context';
import type { CountryCode } from '@/lib/seed-bari/domain';

export async function generateMetadata(): Promise<Metadata> {
  const country: CountryCode = await getStoreCountry('BD');
  const market = country === 'IN' ? 'India' : 'Bangladesh';
  const title = `SEED BARI Blog | Seed Growing Tips & Stories`;
  const description = `Practical seed growing tips, farming knowledge, and seasonal insights for ${market} from SEED BARI.`;

  return {
    title,
    description,
    alternates: { canonical: '/blog' },
    openGraph: {
      title,
      description,
      type: 'website',
      url: '/blog',
    },
  };
}

export default async function BlogPage() {
  const country: CountryCode = await getStoreCountry('BD');
  const { data, error } = await getPublishedBlogPosts(country, 24);
  const posts = data ?? [];

  return (
    <main className="min-h-screen bg-[#f7f8f4] px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 rounded-3xl border bg-white p-8 md:p-12">
          <p className="font-bold text-[#1f6b3b]">SEED BARI BLOG</p>
          <h1 className="mt-2 text-4xl font-black md:text-6xl">Seed growing tips & stories</h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-600">
            Practical farming knowledge, seed guidance, and seasonal insights for our {country === 'IN' ? 'India' : 'Bangladesh'} market.
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border bg-white p-6 text-red-600">Unable to load blog posts right now.</div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border bg-white p-10 text-center">
            <h2 className="text-2xl font-black">No published posts yet</h2>
            <p className="mt-2 text-gray-500">Publish a blog post from the SEED BARI CMS to show it here.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                key={post.id}
                href={`/blog/${post.slug}`}
                className="overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-1 hover:shadow-lg"
              >
                {post.cover_image_url ? (
                  <div className="h-52 bg-[#edf5e9]">
                    <img
                      src={post.cover_image_url}
                      alt={post.title_en || post.title_bn}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : null}
                <div className="p-6">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#1f6b3b]">SEED BARI</p>
                  <h2 className="mt-2 text-xl font-black">{post.title_en || post.title_bn}</h2>
                  {post.excerpt && <p className="mt-3 text-sm leading-6 text-gray-600">{post.excerpt}</p>}
                  <p className="mt-5 font-bold text-[#1f6b3b]">Read article →</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
