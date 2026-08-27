'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getBlogPostBySlug } from '@/lib/data';
import type { BlogPost } from '@/lib/supabase/types';
import Link from 'next/link';
import { useLang } from '@/components/site/language-provider';

export default function BlogPostPage() {
  const { t } = useLang();
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
    return <div className="container-custom py-12"><div className="h-64 animate-pulse rounded-2xl bg-secondary" /></div>;
  }

  if (!post) {
    return (
      <div className="container-custom py-12 text-center">
        <h1 className="text-2xl font-bold">{t('আর্টিকেল পাওয়া যায়নি', 'Article not found')}</h1>
        <Link href="/blog" className="mt-4 inline-block text-primary hover:underline">{t('সব আর্টিকেল দেখুন', 'View all articles')}</Link>
      </div>
    );
  }

  return (
    <div className="container-custom py-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/blog" className="mb-4 inline-block text-sm text-muted-foreground hover:text-primary">← {t('বাগান গাইড', 'Garden Guides')}</Link>
        {post.category && <span className="text-sm font-medium text-primary">{post.category}</span>}
        <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{post.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {new Date(post.publish_date).toLocaleDateString('bn-BD')}
        </p>

        {post.featured_image && (
          <div className="mt-6 overflow-hidden rounded-2xl">
            <img src={post.featured_image} alt={post.title} className="w-full" />
          </div>
        )}

        <div className="mt-6 whitespace-pre-line text-base leading-relaxed text-muted-foreground">
          {post.content}
        </div>
      </div>
    </div>
  );
}
