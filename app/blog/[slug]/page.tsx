'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getBlogPostBySlug } from '@/lib/data';
import type { BlogPost } from '@/lib/supabase/types';
import Link from 'next/link';
import { useLang } from '@/components/site/language-provider';

export default function BlogPostPage() {
  const { lang, t } = useLang();
  const params = useParams();
  const slug = params.slug as string;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlogPostBySlug(slug).then((p) => {
      setPost(p);
      setLoading(false);
    });
  }, [slug]);

  if (loading) {
    return (
      <div className="container-custom py-10 sm:py-14">
        <div className="mx-auto max-w-6xl animate-pulse space-y-5">
          <div className="h-4 w-40 rounded-full bg-secondary" />
          <div className="h-16 w-3/4 rounded-2xl bg-secondary" />
          <div className="h-[360px] rounded-[2rem] bg-secondary sm:h-[480px]" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-80 rounded-3xl bg-secondary" />
            <div className="h-72 rounded-3xl bg-secondary" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="container-custom py-16 text-center sm:py-24">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-border/70 bg-card p-8 shadow-sm sm:p-12">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-2xl text-primary">🌱</div>
          <h1 className="mt-5 text-2xl font-black sm:text-3xl">{t('আর্টিকেল পাওয়া যায়নি', 'Article not found')}</h1>
          <Link href="/blog" className="btn-primary mt-6">
            {t('সব আর্টিকেল দেখুন', 'View all articles')}
          </Link>
        </div>
      </div>
    );
  }

  const translatedPost = (post as any)?.translations?.[lang] || {};
  const postTitle = translatedPost.title || post.title || '';
  const postContent = translatedPost.content || post.content || '';
  const postCategory = translatedPost.category || post.category || '';
  const readingMinutes = Math.max(3, Math.ceil(postContent.trim().split(/\s+/).filter(Boolean).length / 180));
  const publishDate = new Date(post.publish_date).toLocaleDateString('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-background">
      <div className="container-custom py-5 sm:py-7 lg:py-9">
        <div className="mx-auto max-w-7xl">
          {/* Breadcrumb */}
          <div className="mb-5 flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground sm:text-sm">
            <Link href="/" className="transition-colors hover:text-primary">{t('হোম', 'Home')}</Link>
            <span>/</span>
            <Link href="/blog" className="transition-colors hover:text-primary">{t('ব্লগ', 'Blog')}</Link>
            <span>/</span>
            <span className="line-clamp-1 text-foreground/70">{postTitle}</span>
          </div>

          {/* Article hero */}
          <section className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card shadow-xl shadow-foreground/5 sm:rounded-[2.25rem]">
            {post.featured_image ? (
              <div className="relative aspect-[16/8.5] min-h-[330px] overflow-hidden sm:min-h-[420px] lg:min-h-[500px]">
                <img
                  src={post.featured_image}
                  alt={postTitle}
                  className="absolute inset-0 h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/5" />
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-9 lg:p-12">
                  {postCategory && (
                    <span className="inline-flex rounded-full bg-primary px-3.5 py-1.5 text-xs font-black text-primary-foreground shadow-lg sm:text-sm">
                      {postCategory}
                    </span>
                  )}
                  <h1 className="mt-3 max-w-5xl text-3xl font-black leading-[1.12] tracking-tight text-white drop-shadow-lg sm:text-4xl lg:text-6xl">
                    {postTitle}
                  </h1>
                  <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-white/90 sm:text-sm">
                    <span className="inline-flex items-center gap-2">◉ GAZI SEED</span>
                    <span className="inline-flex items-center gap-2">▣ {publishDate}</span>
                    <span className="inline-flex items-center gap-2">◷ {readingMinutes} মিনিট পড়ার সময়</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-7 sm:p-10 lg:p-12">
                {postCategory && (
                  <span className="inline-flex rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-black text-primary sm:text-sm">
                    {postCategory}
                  </span>
                )}
                <h1 className="mt-4 max-w-5xl text-3xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                  {postTitle}
                </h1>
                <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-muted-foreground">
                  <span>GAZI SEED</span><span>{publishDate}</span><span>{readingMinutes} মিনিট</span>
                </div>
              </div>
            )}
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
            {/* Article */}
            <article className="min-w-0 overflow-hidden rounded-[1.5rem] border border-border/70 bg-card shadow-sm sm:rounded-[2rem]">
              <div className="p-5 sm:p-8 lg:p-11">
                <div className="mb-7 rounded-2xl border border-primary/10 bg-primary/[0.055] p-5 sm:p-6">
                  <div className="flex gap-4">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg">💡</div>
                    <div>
                      <h2 className="font-black text-foreground">{t('কৃষকের জন্য গুরুত্বপূর্ণ', 'Important for growers')}</h2>
                      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
                        {t('সঠিক জাত, সময় ও পরিচর্যার তথ্য মেনে চললে ভালো ফলনের সম্ভাবনা বাড়ে।', 'Use the right variety, timing and care practices for better growing results.')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="prose prose-green max-w-none whitespace-pre-line text-[16px] leading-8 text-muted-foreground sm:text-[17px] sm:leading-9">
                  {postContent}
                </div>

                <div className="mt-10 border-t border-border/70 pt-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">GAZI SEED</p>
                      <p className="mt-1 font-bold text-foreground">{t('বিশুদ্ধ বীজের বিশ্বস্ত নাম', 'Trusted name for quality seeds')}</p>
                    </div>
                    <Link href="/blog" className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary hover:text-primary-foreground">
                      ← {t('আরও পড়ুন', 'Read more')}
                    </Link>
                  </div>
                </div>
              </div>
            </article>

            {/* Sidebar */}
            <aside className="space-y-5 lg:sticky lg:top-28">
              <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
                <h2 className="text-lg font-black">{t('ব্লগ খুঁজুন', 'Search articles')}</h2>
                <Link
                  href="/blog"
                  className="mt-3 flex items-center justify-between rounded-xl border border-input bg-background px-4 py-3 text-sm text-muted-foreground transition hover:border-primary/40 hover:text-primary"
                >
                  <span>{t('বিষয় লিখুন...', 'Browse all articles...')}</span>
                  <span className="font-black text-primary">⌕</span>
                </Link>
              </div>

              <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
                <h2 className="text-lg font-black">{t('ব্লগ ক্যাটাগরি', 'Blog categories')}</h2>
                <div className="mt-3 space-y-1">
                  {[
                    t('কৃষি পরামর্শ', 'Agriculture Tips'),
                    t('সবজি চাষ', 'Vegetable Growing'),
                    t('বীজ নির্বাচন', 'Seed Selection'),
                    t('ফসলের রোগ ও পোকা', 'Pests & Diseases'),
                    t('জৈব কৃষি', 'Organic Farming'),
                  ].map((item, index) => (
                    <Link
                      key={item}
                      href="/blog"
                      className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition hover:bg-primary/5 hover:text-primary"
                    >
                      <span className="flex items-center gap-2"><span className="text-primary">›</span>{item}</span>
                      <span className="text-xs text-muted-foreground/60">0{index + 1}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="relative overflow-hidden rounded-3xl border border-primary/10 bg-gradient-to-br from-primary/[0.08] via-card to-accent/[0.10] p-6 shadow-sm">
                <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl" />
                <div className="relative">
                  <div className="text-3xl">🌱</div>
                  <h2 className="mt-3 text-xl font-black">{t('উন্নত মানের বীজ কিনুন', 'Shop quality seeds')}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {t('চাষের জন্য প্রয়োজনীয় মানসম্মত বীজ এক জায়গায় খুঁজে নিন।', 'Find quality seeds for your growing needs in one place.')}
                  </p>
                  <Link href="/products" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:-translate-y-0.5">
                    {t('বীজ পণ্য দেখুন', 'Explore seeds')} →
                  </Link>
                </div>
              </div>

              <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-sm">
                <h2 className="text-lg font-black">{t('কেন GAZI SEED?', 'Why GAZI SEED?')}</h2>
                <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                  {[
                    t('মানসম্মত বীজ', 'Quality seeds'),
                    t('কৃষি বিষয়ক তথ্য', 'Practical growing information'),
                    t('সহজ অনলাইন অর্ডার', 'Easy online ordering'),
                    t('বিশ্বস্ত সেবা', 'Trusted service'),
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-black text-primary">✓</span>
                      <span className="font-semibold">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
