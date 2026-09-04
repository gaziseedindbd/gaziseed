'use server';

import Link from 'next/link';
import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

async function requireMasterAdmin() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Unauthorized');

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (profile?.role !== 'master_admin') throw new Error('Master Admin access required.');

  return supabase;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function nullable(value: string) {
  return value || null;
}

export async function saveBlogPost(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  const titleBn = text(formData, 'title_bn');
  const titleEn = text(formData, 'title_en');
  const slug = text(formData, 'slug').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  const country = text(formData, 'country') || 'BD';
  const excerpt = text(formData, 'excerpt');
  const contentBn = text(formData, 'content_bn');
  const contentEn = text(formData, 'content_en');
  const coverImageUrl = text(formData, 'cover_image_url');
  const published = formData.get('published') === 'on';

  if (!titleBn && !titleEn) throw new Error('A Bangla or English title is required.');
  if (!slug) throw new Error('A valid slug is required.');

  const payload = {
    country: country === 'IN' ? 'IN' : 'BD',
    title_bn: nullable(titleBn),
    title_en: nullable(titleEn),
    slug,
    excerpt: nullable(excerpt),
    content_bn: nullable(contentBn),
    content_en: nullable(contentEn),
    cover_image_url: nullable(coverImageUrl),
    published,
    published_at: published ? new Date().toISOString() : null,
  };

  if (id) {
    const { error } = await supabase.from('blog_posts').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('blog_posts').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/cms/blog');
  revalidatePath('/blog');
}

export async function deleteBlogPost(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  if (!id) throw new Error('Post id is required.');

  const { error } = await supabase.from('blog_posts').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/cms/blog');
  revalidatePath('/blog');
}

export default async function BlogCmsPage() {
  const supabase = await requireMasterAdmin();
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('id,country,title_bn,title_en,slug,excerpt,content_bn,content_en,cover_image_url,published,published_at,created_at')
    .order('created_at', { ascending: false });

  if (error) {
    return <main className="p-6 text-red-600">Unable to load blog posts: {error.message}</main>;
  }

  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/cms" className="text-sm font-bold text-[#1f6b3b]">← CMS & Marketing</Link>
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI CMS</p>
            <h1 className="mt-1 text-3xl font-black">Blog Management</h1>
            <p className="mt-2 text-gray-500">Create, edit, publish and remove SEO-friendly articles.</p>
          </div>
          <a href="/blog" target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 font-bold">View Blog →</a>
        </div>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Create new post</h2>
          <form action={saveBlogPost} className="mt-5 grid gap-4 md:grid-cols-2">
            <input name="title_bn" placeholder="Title (Bangla)" className="rounded-xl border p-3" />
            <input name="title_en" placeholder="Title (English)" className="rounded-xl border p-3" />
            <input name="slug" placeholder="slug" className="rounded-xl border p-3" />
            <select name="country" defaultValue="BD" className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
            <input name="cover_image_url" placeholder="Cover image URL" className="rounded-xl border p-3 md:col-span-2" />
            <textarea name="excerpt" placeholder="Excerpt" rows={3} className="rounded-xl border p-3 md:col-span-2" />
            <textarea name="content_bn" placeholder="Bangla content (HTML allowed)" rows={10} className="rounded-xl border p-3" />
            <textarea name="content_en" placeholder="English content (HTML allowed)" rows={10} className="rounded-xl border p-3" />
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="published" /> Publish now</label>
            <div className="md:text-right"><button className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white">Save Post</button></div>
          </form>
        </section>

        <section className="mt-8 space-y-5">
          {(posts ?? []).map((post) => (
            <article key={post.id} className="rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{post.title_en || post.title_bn || 'Untitled post'}</h2>
                  <p className="mt-1 text-sm text-gray-500">/{post.slug} · {post.country} · {post.published ? 'Published' : 'Draft'}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-bold">Open</a>
                  <form action={deleteBlogPost}><input type="hidden" name="id" value={post.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Delete</button></form>
                </div>
              </div>

              <form action={saveBlogPost} className="mt-5 grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={post.id} />
                <input name="title_bn" defaultValue={post.title_bn ?? ''} placeholder="Title (Bangla)" className="rounded-xl border p-3" />
                <input name="title_en" defaultValue={post.title_en ?? ''} placeholder="Title (English)" className="rounded-xl border p-3" />
                <input name="slug" defaultValue={post.slug} placeholder="slug" className="rounded-xl border p-3" />
                <select name="country" defaultValue={post.country} className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
                <input name="cover_image_url" defaultValue={post.cover_image_url ?? ''} placeholder="Cover image URL" className="rounded-xl border p-3 md:col-span-2" />
                <textarea name="excerpt" defaultValue={post.excerpt ?? ''} placeholder="Excerpt" rows={3} className="rounded-xl border p-3 md:col-span-2" />
                <textarea name="content_bn" defaultValue={post.content_bn ?? ''} placeholder="Bangla content (HTML allowed)" rows={8} className="rounded-xl border p-3" />
                <textarea name="content_en" defaultValue={post.content_en ?? ''} placeholder="English content (HTML allowed)" rows={8} className="rounded-xl border p-3" />
                <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="published" defaultChecked={post.published} /> Published</label>
                <div className="md:text-right"><button className="rounded-xl border px-5 py-3 font-bold">Update Post</button></div>
              </form>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
