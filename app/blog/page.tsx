'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BookOpen, Leaf, Sparkles } from 'lucide-react';
import { getBlogPosts } from '@/lib/data';
import type { BlogPost } from '@/lib/supabase/types';
import Link from 'next/link';
import { useLang } from '@/components/site/language-provider';

export default function BlogPage() {
  const { t } = useLang();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlogPosts().then((p) => {
      setPosts(p);
      setLoading(false);
    });
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(posts.map((post) => post.category).filter(Boolean))).slice(0, 5) as string[],
    [posts]
  );

  const featured = posts[0];
  const remaining = posts.slice(1);

  return (
    <main className="min-h-screen bg-background">
      <section className="relative overflow-hidden border-b border-border/60 bg-gradient-to-br from-primary/[0.08] via-background to-secondary/50">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-accent/60 blur-3xl" />

        <div className="container-custom relative py-14 sm:py-18 lg:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/80 px-4 py-2 text-xs font-bold tracking-[0.16em] text-primary shadow-sm backdrop-blur">
              <Leaf className="h-3.5 w-3.5" />
              SEED BARI • GARDEN JOURNAL
            </div>
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {t('বাগান গাইড', 'Garden Guides')}
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              {t(
                'বীজ নির্বাচন, চাষাবাদ ও বাগান পরিচর্যা নিয়ে সহজ, কাজে লাগার মতো গাইড—SEED BARI-এর সঙ্গে আরও ভালোভাবে চাষ করুন।',
                'Practical guides on seeds, cultivation and gardening—learn, grow and garden better with SEED BARI.'
              )}
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-sm">
                {t('সব আর্টিকেল', 'All Articles')}
              </span>
              {categories.map((category) => (
                <span key={category} className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground">
                  {category}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="container-custom py-10 sm:py-14">
        {loading ? (
          <div className="space-y-10">
            <div className="grid overflow-hidden rounded-[2rem] border border-border bg-card lg:grid-cols-2">
              <div className="aspect-[16/10] animate-pulse bg-secondary lg:aspect-auto lg:min-h-[360px]" />
              <div className="space-y-4 p-7 sm:p-10">
                <div className="h-4 w-24 animate-pulse rounded bg-secondary" />
                <div className="h-10 w-4/5 animate-pulse rounded bg-secondary" />
                <div className="h-20 w-full animate-pulse rounded bg-secondary" />
                <div className="h-10 w-32 animate-pulse rounded-full bg-secondary" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-[360px] animate-pulse rounded-3xl bg-secondary" />
              ))}
            </div>
          </div>
        ) : posts.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-[2rem] border border-dashed border-border bg-card p-12 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <BookOpen className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-foreground">{t('এখনও কোনো আর্টিকেল নেই', 'No articles yet')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {t('নতুন বাগান ও চাষাবাদ গাইড খুব শিগগিরই এখানে প্রকাশিত হবে।', 'Fresh gardening and cultivation guides will appear here soon.')}
            </p>
          </div>
        ) : (
          <>
            {featured && (
              <section>
                <div className="mb-5 flex items-end justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {t('ফিচার্ড আর্টিকেল', 'Featured Article')}
                    </div>
                    <h2 className="text-2xl font-black tracking-tight sm:text-3xl">{t('চাষাবাদ ও বাগানের সেরা গাইড', 'Top Guides for Better Growing')}</h2>
                  </div>
                </div>

                <Link
                  href={`/blog/${featured.slug}`}
                  className="group grid overflow-hidden rounded-[2rem] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-2xl lg:grid-cols-2"
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-secondary/40 lg:aspect-auto lg:min-h-[360px]">
                    {featured.featured_image ? (
                      <img src={featured.featured_image} alt={featured.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-secondary text-6xl">🌱</div>
                    )}
                    <div className="absolute left-5 top-5 rounded-full bg-background/90 px-3 py-1.5 text-xs font-bold text-primary shadow-sm backdrop-blur">
                      {featured.category || t('বাগান ও চাষাবাদ', 'Gardening & Cultivation')}
                    </div>
                  </div>
                  <div className="flex flex-col justify-center p-7 sm:p-10">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">SEED BARI JOURNAL</p>
                    <h3 className="mt-3 text-2xl font-black leading-tight text-foreground sm:text-3xl lg:text-4xl">{featured.title}</h3>
                    <p className="mt-4 line-clamp-4 text-sm leading-7 text-muted-foreground sm:text-base">
                      {featured.content.slice(0, 280)}{featured.content.length > 280 ? '…' : ''}
                    </p>
                    <span className="mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/15 transition-all group-hover:gap-3">
                      {t('আর্টিকেল পড়ুন', 'Read article')}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              </section>
            )}

            {remaining.length > 0 && (
              <section className="mt-14">
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">SEED BARI JOURNAL</p>
                    <h2 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{t('সর্বশেষ গাইড', 'Latest Guides')}</h2>
                  </div>
                  <span className="hidden rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground sm:inline-flex">
                    {remaining.length} {t('টি লেখা', 'articles')}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {remaining.map((post) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug}`}
                      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl"
                    >
                      <div className="relative aspect-[16/10] overflow-hidden bg-secondary/40">
                        {post.featured_image ? (
                          <img src={post.featured_image} alt={post.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" loading="lazy" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-secondary text-5xl">🌱</div>
                        )}
                        {post.category && (
                          <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1.5 text-[11px] font-bold text-primary shadow-sm backdrop-blur">
                            {post.category}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-1 flex-col p-5 sm:p-6">
                        <h3 className="line-clamp-2 text-lg font-extrabold leading-snug text-foreground transition-colors group-hover:text-primary">{post.title}</h3>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted-foreground">
                          {post.content.slice(0, 150)}{post.content.length > 150 ? '…' : ''}
                        </p>
                        <div className="mt-auto flex items-center justify-between pt-6 text-xs font-bold text-primary">
                          <span>{t('আরও পড়ুন', 'Read more')}</span>
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 transition-transform group-hover:translate-x-1">
                            <ArrowRight className="h-4 w-4" />
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
