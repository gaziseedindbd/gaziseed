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

function text(formData: FormData, key: string) { return String(formData.get(key) ?? '').trim(); }
function nullable(value: string) { return value || null; }

export async function saveBanner(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  const title = text(formData, 'title');
  const imageUrl = text(formData, 'image_url');
  const mobileImageUrl = text(formData, 'mobile_image_url');
  const linkUrl = text(formData, 'link_url');
  const country = text(formData, 'country') === 'IN' ? 'IN' : 'BD';
  const active = formData.get('active') === 'on';
  const sortOrder = Number(text(formData, 'sort_order') || 0);
  const startsAt = text(formData, 'starts_at');
  const expiresAt = text(formData, 'expires_at');

  if (!title) throw new Error('Banner title is required.');
  if (!imageUrl) throw new Error('Desktop image URL is required.');

  const payload = {
    country,
    title,
    image_url: imageUrl,
    mobile_image_url: nullable(mobileImageUrl),
    link_url: nullable(linkUrl),
    active,
    starts_at: nullable(startsAt),
    expires_at: nullable(expiresAt),
    sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
  };

  const query = id
    ? supabase.from('banners').update(payload).eq('id', id)
    : supabase.from('banners').insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);

  revalidatePath('/admin/cms/banners');
  revalidatePath('/');
}

export async function deleteBanner(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  if (!id) throw new Error('Banner id is required.');
  const { error } = await supabase.from('banners').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/cms/banners');
  revalidatePath('/');
}

function dateTimeLocal(value: string | null) {
  if (!value) return '';
  return value.length >= 16 ? value.slice(0, 16) : value;
}

export default async function BannersCmsPage() {
  const supabase = await requireMasterAdmin();
  const { data: banners, error } = await supabase
    .from('banners')
    .select('id,country,title,image_url,mobile_image_url,link_url,active,starts_at,expires_at,sort_order,created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false });

  if (error) return <main className="p-6 text-red-600">Unable to load banners: {error.message}</main>;

  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/cms" className="text-sm font-bold text-[#1f6b3b]">← CMS & Marketing</Link>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI CMS</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="mt-1 text-3xl font-black">Banner Management</h1><p className="mt-2 text-gray-500">Control desktop/mobile hero banners, links and scheduling.</p></div>
          <a href="/" target="_blank" rel="noreferrer" className="rounded-xl border px-4 py-2 font-bold">View Storefront →</a>
        </div>

        <section className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Create new banner</h2>
          <form action={saveBanner} className="mt-5 grid gap-4 md:grid-cols-2">
            <input name="title" placeholder="Banner title" className="rounded-xl border p-3" required />
            <select name="country" defaultValue="BD" className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
            <input name="image_url" placeholder="Desktop image URL" className="rounded-xl border p-3 md:col-span-2" required />
            <input name="mobile_image_url" placeholder="Mobile image URL (optional)" className="rounded-xl border p-3 md:col-span-2" />
            <input name="link_url" placeholder="Click link URL (optional)" className="rounded-xl border p-3" />
            <input name="sort_order" type="number" defaultValue="0" placeholder="Display order" className="rounded-xl border p-3" />
            <input name="starts_at" type="datetime-local" className="rounded-xl border p-3" />
            <input name="expires_at" type="datetime-local" className="rounded-xl border p-3" />
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked /> Active</label>
            <div className="md:text-right"><button className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white">Save Banner</button></div>
          </form>
        </section>

        <section className="mt-8 space-y-5">
          {(banners ?? []).map((banner) => (
            <article key={banner.id} className="rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div><h2 className="text-xl font-black">{banner.title}</h2><p className="mt-1 text-sm text-gray-500">{banner.country} · {banner.active ? 'Active' : 'Inactive'} · order {banner.sort_order}</p></div>
                <form action={deleteBanner}><input type="hidden" name="id" value={banner.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Delete</button></form>
              </div>
              <form action={saveBanner} className="mt-5 grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={banner.id} />
                <input name="title" defaultValue={banner.title} className="rounded-xl border p-3" required />
                <select name="country" defaultValue={banner.country} className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
                <input name="image_url" defaultValue={banner.image_url} className="rounded-xl border p-3 md:col-span-2" required />
                <input name="mobile_image_url" defaultValue={banner.mobile_image_url ?? ''} className="rounded-xl border p-3 md:col-span-2" placeholder="Mobile image URL" />
                <input name="link_url" defaultValue={banner.link_url ?? ''} className="rounded-xl border p-3" placeholder="Link URL" />
                <input name="sort_order" type="number" defaultValue={banner.sort_order} className="rounded-xl border p-3" />
                <input name="starts_at" type="datetime-local" defaultValue={dateTimeLocal(banner.starts_at)} className="rounded-xl border p-3" />
                <input name="expires_at" type="datetime-local" defaultValue={dateTimeLocal(banner.expires_at)} className="rounded-xl border p-3" />
                <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={banner.active} /> Active</label>
                <div className="md:text-right"><button className="rounded-xl border px-5 py-3 font-bold">Update Banner</button></div>
              </form>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
