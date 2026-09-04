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

export async function savePopup(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  const title = text(formData, 'title');
  const description = text(formData, 'description');
  const imageUrl = text(formData, 'image_url');
  const ctaLink = text(formData, 'cta_link');
  const offerText = text(formData, 'offer_text');
  const ctaText = text(formData, 'cta_text');
  const countryValue = text(formData, 'country');
  const country = countryValue === 'IN' ? 'IN' : countryValue === 'ANY' ? null : 'BD';
  const startsAt = text(formData, 'starts_at');
  const expiresAt = text(formData, 'expires_at');
  const closeable = formData.get('closeable') === 'on';
  const displayFrequency = text(formData, 'display_frequency') || 'session';
  const delaySeconds = Math.max(0, Number(text(formData, 'delay_seconds') || '0'));
  const active = formData.get('active') === 'on';

  if (!title) throw new Error('Popup title is required.');
  if (!Number.isFinite(delaySeconds)) throw new Error('Delay seconds must be a valid number.');

  const payload = {
    country,
    title,
    description: nullable(description),
    image_url: nullable(imageUrl),
    cta_link: nullable(ctaLink),
    offer_text: nullable(offerText),
    cta_text: nullable(ctaText),
    starts_at: startsAt ? new Date(startsAt).toISOString() : null,
    expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    closeable,
    display_frequency: displayFrequency,
    delay_seconds: Math.floor(delaySeconds),
    active,
  };

  const result = id
    ? await supabase.from('promotional_popups').update(payload).eq('id', id)
    : await supabase.from('promotional_popups').insert(payload);

  if (result.error) throw new Error(result.error.message);

  revalidatePath('/admin/cms/popups');
  revalidatePath('/');
}

export async function deletePopup(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  if (!id) throw new Error('Popup id is required.');
  const { error } = await supabase.from('promotional_popups').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/cms/popups');
  revalidatePath('/');
}

function dateValue(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

function PopupForm({ popup }: { popup?: any }) {
  return (
    <form action={savePopup} className="grid gap-3 md:grid-cols-2">
      {popup && <input type="hidden" name="id" value={popup.id} />}
      <input name="title" defaultValue={popup?.title ?? ''} placeholder="Popup title" className="rounded-xl border p-3 md:col-span-2" />
      <select name="country" defaultValue={popup ? (popup.country ?? 'ANY') : 'BD'} className="rounded-xl border p-3">
        <option value="BD">Bangladesh</option><option value="IN">India</option><option value="ANY">All countries</option>
      </select>
      <input name="delay_seconds" type="number" min="0" defaultValue={popup?.delay_seconds ?? 0} placeholder="Delay seconds" className="rounded-xl border p-3" />
      <input name="image_url" defaultValue={popup?.image_url ?? ''} placeholder="Image URL" className="rounded-xl border p-3 md:col-span-2" />
      <input name="cta_link" defaultValue={popup?.cta_link ?? ''} placeholder="CTA link" className="rounded-xl border p-3" />
      <input name="cta_text" defaultValue={popup?.cta_text ?? ''} placeholder="CTA text" className="rounded-xl border p-3" />
      <input name="offer_text" defaultValue={popup?.offer_text ?? ''} placeholder="Offer text" className="rounded-xl border p-3 md:col-span-2" />
      <textarea name="description" defaultValue={popup?.description ?? ''} placeholder="Description" rows={4} className="rounded-xl border p-3 md:col-span-2" />
      <input name="starts_at" type="datetime-local" defaultValue={dateValue(popup?.starts_at ?? null)} className="rounded-xl border p-3" />
      <input name="expires_at" type="datetime-local" defaultValue={dateValue(popup?.expires_at ?? null)} className="rounded-xl border p-3" />
      <select name="display_frequency" defaultValue={popup?.display_frequency ?? 'session'} className="rounded-xl border p-3">
        <option value="once">Once</option><option value="session">Per session</option><option value="always">Always</option>
      </select>
      <div className="flex items-center gap-5 rounded-xl border p-3">
        <label className="flex items-center gap-2"><input type="checkbox" name="closeable" defaultChecked={popup ? popup.closeable : true} /> Closeable</label>
        <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={popup ? popup.active : true} /> Active</label>
      </div>
      <button className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white md:col-span-2">{popup ? 'Update Popup' : 'Save Popup'}</button>
    </form>
  );
}

export default async function PopupCmsPage() {
  const supabase = await requireMasterAdmin();
  const { data: popups, error } = await supabase.from('promotional_popups')
    .select('id,country,title,description,image_url,cta_link,offer_text,cta_text,starts_at,expires_at,closeable,display_frequency,delay_seconds,active,created_at')
    .order('created_at', { ascending: false });

  if (error) return <main className="p-6 text-red-600">Unable to load popups: {error.message}</main>;

  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/admin/cms" className="text-sm font-bold text-[#1f6b3b]">← CMS & Marketing</Link>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI CMS</p>
        <h1 className="mt-1 text-3xl font-black">Promotional Popups</h1>
        <p className="mt-2 text-gray-500">Schedule offers, CTAs and timed storefront popups by country.</p>

        <section className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Create new popup</h2>
          <div className="mt-5"><PopupForm /></div>
        </section>

        <section className="mt-8 space-y-5">
          {(popups ?? []).map((popup) => (
            <article key={popup.id} className="rounded-2xl border bg-white p-6">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{popup.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">{popup.country ?? 'ALL'} · {popup.active ? 'Active' : 'Inactive'} · {popup.display_frequency}</p>
                </div>
                <form action={deletePopup}><input type="hidden" name="id" value={popup.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Delete</button></form>
              </div>
              <PopupForm popup={popup} />
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
