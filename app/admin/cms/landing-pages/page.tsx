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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseContent(raw: string) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Content must be a JSON object.');
    return parsed;
  } catch {
    throw new Error('Content must be valid JSON object syntax.');
  }
}

export async function saveLandingPage(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  const title = text(formData, 'title');
  const slug = slugify(text(formData, 'slug'));
  const type = text(formData, 'type') || 'campaign';
  const country = text(formData, 'country') || 'BD';
  const content = parseContent(text(formData, 'content'));
  const animated = formData.get('animated') === 'on';
  const active = formData.get('active') === 'on';

  if (!title) throw new Error('Landing page title is required.');
  if (!slug) throw new Error('A valid slug is required.');

  const payload = { title, slug, type, country: country === 'IN' ? 'IN' : 'BD', content, animated, active };

  if (id) {
    const { error } = await supabase.from('landing_pages').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('landing_pages').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/cms/landing-pages');
}

export async function deleteLandingPage(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  if (!id) throw new Error('Landing page id is required.');
  const { error } = await supabase.from('landing_pages').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/cms/landing-pages');
}

const defaultContent = JSON.stringify({
  heading: 'Grow Better with SEED BARI',
  description: 'Your campaign message goes here.',
  cta_text: 'Shop Now',
  cta_link: '/shop',
  image_url: ''
}, null, 2);

function LandingForm({ page }: { page?: any }) {
  return (
    <form action={saveLandingPage} className="grid gap-4 md:grid-cols-2">
      {page && <input type="hidden" name="id" value={page.id} />}
      <input name="title" defaultValue={page?.title ?? ''} placeholder="Landing page title" className="rounded-xl border p-3 md:col-span-2" />
      <input name="slug" defaultValue={page?.slug ?? ''} placeholder="slug" className="rounded-xl border p-3" />
      <select name="country" defaultValue={page?.country ?? 'BD'} className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
      <select name="type" defaultValue={page?.type ?? 'campaign'} className="rounded-xl border p-3"><option value="campaign">Campaign</option><option value="product">Product</option><option value="offer">Offer</option><option value="ad">Advertisement</option></select>
      <label className="flex items-center gap-2 rounded-xl border p-3 font-bold"><input type="checkbox" name="animated" defaultChecked={page?.animated ?? false} /> Animated</label>
      <textarea name="content" defaultValue={page ? JSON.stringify(page.content ?? {}, null, 2) : defaultContent} rows={14} placeholder="Content JSON" className="rounded-xl border p-3 font-mono text-sm md:col-span-2" />
      <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={page ? page.active : true} /> Active</label>
      <div className="md:text-right"><button className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white">{page ? 'Update Landing Page' : 'Save Landing Page'}</button></div>
    </form>
  );
}

export default async function LandingPagesCmsPage() {
  const supabase = await requireMasterAdmin();
  const { data: pages, error } = await supabase
    .from('landing_pages')
    .select('id,country,title,slug,type,content,animated,active,created_at,updated_at')
    .order('created_at', { ascending: false });

  if (error) return <main className="p-6 text-red-600">Unable to load landing pages: {error.message}</main>;

  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/cms" className="text-sm font-bold text-[#1f6b3b]">← CMS & Marketing</Link>
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI CMS</p>
            <h1 className="mt-1 text-3xl font-black">Landing Page Management</h1>
            <p className="mt-2 text-gray-500">Create campaign landing pages with structured JSON content.</p>
          </div>
        </div>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Create new landing page</h2>
          <div className="mt-5"><LandingForm /></div>
        </section>

        <section className="mt-8 space-y-5">
          {(pages ?? []).map((page) => (
            <article key={page.id} className="rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{page.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">/landing/{page.slug} · {page.country} · {page.type} · {page.active ? 'Active' : 'Inactive'}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/landing/${page.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-bold">Open</a>
                  <form action={deleteLandingPage}><input type="hidden" name="id" value={page.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Delete</button></form>
                </div>
              </div>
              <div className="mt-5"><LandingForm page={page} /></div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
