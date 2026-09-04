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

export async function saveGuide(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  const titleBn = text(formData, 'title_bn');
  const titleEn = text(formData, 'title_en');
  const slug = slugify(text(formData, 'slug'));
  const country = text(formData, 'country') || 'BD';
  const contentBn = text(formData, 'content_bn');
  const contentEn = text(formData, 'content_en');
  const active = formData.get('active') === 'on';

  if (!titleBn && !titleEn) throw new Error('A Bangla or English title is required.');
  if (!slug) throw new Error('A valid slug is required.');

  const payload = {
    country: country === 'IN' ? 'IN' : 'BD',
    title_bn: nullable(titleBn),
    title_en: nullable(titleEn),
    slug,
    content_bn: nullable(contentBn),
    content_en: nullable(contentEn),
    active,
  };

  if (id) {
    const { error } = await supabase.from('guides').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('guides').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/cms/guides');
  revalidatePath('/guides');
}

export async function deleteGuide(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  if (!id) throw new Error('Guide id is required.');

  const { error } = await supabase.from('guides').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/cms/guides');
  revalidatePath('/guides');
}

export default async function GuidesCmsPage() {
  const supabase = await requireMasterAdmin();
  const { data: guides, error } = await supabase
    .from('guides')
    .select('id,country,title_bn,title_en,slug,content_bn,content_en,active')
    .order('slug');

  if (error) {
    return <main className="p-6 text-red-600">Unable to load guides: {error.message}</main>;
  }

  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/cms" className="text-sm font-bold text-[#1f6b3b]">← CMS & Marketing</Link>
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI CMS</p>
            <h1 className="mt-1 text-3xl font-black">Guide Management</h1>
            <p className="mt-2 text-gray-500">Create, edit, activate or remove agricultural guides.</p>
          </div>
          <a href="/guides" target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 font-bold">View Guides →</a>
        </div>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Create new guide</h2>
          <form action={saveGuide} className="mt-5 grid gap-4 md:grid-cols-2">
            <input name="title_bn" placeholder="Title (Bangla)" className="rounded-xl border p-3" />
            <input name="title_en" placeholder="Title (English)" className="rounded-xl border p-3" />
            <input name="slug" placeholder="slug" className="rounded-xl border p-3" />
            <select name="country" defaultValue="BD" className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
            <textarea name="content_bn" placeholder="Bangla guide content (HTML allowed)" rows={12} className="rounded-xl border p-3" />
            <textarea name="content_en" placeholder="English guide content (HTML allowed)" rows={12} className="rounded-xl border p-3" />
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked /> Active</label>
            <div className="md:text-right"><button className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white">Save Guide</button></div>
          </form>
        </section>

        <section className="mt-8 space-y-5">
          {(guides ?? []).map((guide) => (
            <article key={guide.id} className="rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{guide.title_en || guide.title_bn || 'Untitled guide'}</h2>
                  <p className="mt-1 text-sm text-gray-500">/{guide.slug} · {guide.country} · {guide.active ? 'Active' : 'Inactive'}</p>
                </div>
                <div className="flex gap-2">
                  <a href={`/guides/${guide.slug}`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-sm font-bold">Open</a>
                  <form action={deleteGuide}><input type="hidden" name="id" value={guide.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Delete</button></form>
                </div>
              </div>

              <form action={saveGuide} className="mt-5 grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={guide.id} />
                <input name="title_bn" defaultValue={guide.title_bn ?? ''} placeholder="Title (Bangla)" className="rounded-xl border p-3" />
                <input name="title_en" defaultValue={guide.title_en ?? ''} placeholder="Title (English)" className="rounded-xl border p-3" />
                <input name="slug" defaultValue={guide.slug} placeholder="slug" className="rounded-xl border p-3" />
                <select name="country" defaultValue={guide.country} className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
                <textarea name="content_bn" defaultValue={guide.content_bn ?? ''} placeholder="Bangla guide content (HTML allowed)" rows={9} className="rounded-xl border p-3" />
                <textarea name="content_en" defaultValue={guide.content_en ?? ''} placeholder="English guide content (HTML allowed)" rows={9} className="rounded-xl border p-3" />
                <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={guide.active} /> Active</label>
                <div className="md:text-right"><button className="rounded-xl border px-5 py-3 font-bold">Update Guide</button></div>
              </form>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
