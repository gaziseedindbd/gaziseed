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

function numberValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function dateValue(formData: FormData, key: string) {
  const raw = text(formData, key);
  return raw ? new Date(raw).toISOString() : null;
}

export async function saveFreeGift(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  const title = text(formData, 'title');
  const country = text(formData, 'country');
  const minOrder = numberValue(formData, 'min_order');
  const giftProductId = text(formData, 'gift_product_id');
  const startsAt = dateValue(formData, 'starts_at');
  const expiresAt = dateValue(formData, 'expires_at');
  const active = formData.get('active') === 'on';

  if (!title) throw new Error('Promotion title is required.');
  if (minOrder === null || minOrder < 0) throw new Error('A valid minimum order amount is required.');
  if (!giftProductId) throw new Error('Gift product id is required.');

  const payload = {
    country: country || null,
    title,
    min_order: minOrder,
    gift_product_id: giftProductId,
    active,
    starts_at: startsAt,
    expires_at: expiresAt,
  };

  if (id) {
    const { error } = await supabase.from('free_gift_promotions').update(payload).eq('id', id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('free_gift_promotions').insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath('/admin/cms/free-gifts');
}

export async function deleteFreeGift(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  if (!id) throw new Error('Promotion id is required.');

  const { error } = await supabase.from('free_gift_promotions').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/admin/cms/free-gifts');
}

function toInputDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

export default async function FreeGiftCmsPage() {
  const supabase = await requireMasterAdmin();

  const [{ data: promotions, error: promotionsError }, { data: products, error: productsError }] = await Promise.all([
    supabase
      .from('free_gift_promotions')
      .select('id,country,title,min_order,gift_product_id,active,starts_at,expires_at,created_at')
      .order('created_at', { ascending: false }),
    supabase
      .from('products')
      .select('id,name_bn,name_en,sku,country,active')
      .eq('active', true)
      .order('name_en')
      .limit(500),
  ]);

  if (promotionsError) {
    return <main className="p-6 text-red-600">Unable to load free gift promotions: {promotionsError.message}</main>;
  }

  if (productsError) {
    return <main className="p-6 text-red-600">Unable to load gift products: {productsError.message}</main>;
  }

  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link href="/admin/cms" className="text-sm font-bold text-[#1f6b3b]">← CMS & Marketing</Link>
            <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI CMS</p>
            <h1 className="mt-1 text-3xl font-black">Free Gift Promotions</h1>
            <p className="mt-2 text-gray-500">Set order-value thresholds that unlock a free seed product.</p>
          </div>
        </div>

        <section className="rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Create promotion</h2>
          <form action={saveFreeGift} className="mt-5 grid gap-4 md:grid-cols-2">
            <input name="title" placeholder="Promotion title" className="rounded-xl border p-3 md:col-span-2" />
            <select name="country" defaultValue="" className="rounded-xl border p-3">
              <option value="">All countries</option>
              <option value="BD">Bangladesh</option>
              <option value="IN">India</option>
            </select>
            <input name="min_order" type="number" min="0" step="0.01" placeholder="Minimum order amount" className="rounded-xl border p-3" />
            <select name="gift_product_id" defaultValue="" className="rounded-xl border p-3 md:col-span-2">
              <option value="">Select gift product</option>
              {(products ?? []).map((product) => (
                <option key={product.id} value={product.id}>
                  {(product.name_en || product.name_bn || 'Unnamed product')} · {product.sku} · {product.country}
                </option>
              ))}
            </select>
            <label className="text-sm font-bold">Start
              <input name="starts_at" type="datetime-local" className="mt-1 w-full rounded-xl border p-3 font-normal" />
            </label>
            <label className="text-sm font-bold">End
              <input name="expires_at" type="datetime-local" className="mt-1 w-full rounded-xl border p-3 font-normal" />
            </label>
            <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" /> Active now</label>
            <div className="md:text-right"><button className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white">Save Promotion</button></div>
          </form>
        </section>

        <section className="mt-8 space-y-5">
          {(promotions ?? []).map((promotion) => (
            <article key={promotion.id} className="rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{promotion.title}</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {promotion.country || 'All countries'} · Minimum order {promotion.min_order} · {promotion.active ? 'Active' : 'Inactive'}
                  </p>
                </div>
                <form action={deleteFreeGift}>
                  <input type="hidden" name="id" value={promotion.id} />
                  <button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Delete</button>
                </form>
              </div>

              <form action={saveFreeGift} className="mt-5 grid gap-3 md:grid-cols-2">
                <input type="hidden" name="id" value={promotion.id} />
                <input name="title" defaultValue={promotion.title} placeholder="Promotion title" className="rounded-xl border p-3 md:col-span-2" />
                <select name="country" defaultValue={promotion.country ?? ''} className="rounded-xl border p-3">
                  <option value="">All countries</option>
                  <option value="BD">Bangladesh</option>
                  <option value="IN">India</option>
                </select>
                <input name="min_order" type="number" min="0" step="0.01" defaultValue={promotion.min_order ?? ''} placeholder="Minimum order amount" className="rounded-xl border p-3" />
                <select name="gift_product_id" defaultValue={promotion.gift_product_id} className="rounded-xl border p-3 md:col-span-2">
                  {(products ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {(product.name_en || product.name_bn || 'Unnamed product')} · {product.sku} · {product.country}
                    </option>
                  ))}
                </select>
                <label className="text-sm font-bold">Start
                  <input name="starts_at" type="datetime-local" defaultValue={toInputDate(promotion.starts_at)} className="mt-1 w-full rounded-xl border p-3 font-normal" />
                </label>
                <label className="text-sm font-bold">End
                  <input name="expires_at" type="datetime-local" defaultValue={toInputDate(promotion.expires_at)} className="mt-1 w-full rounded-xl border p-3 font-normal" />
                </label>
                <label className="flex items-center gap-2 font-bold"><input type="checkbox" name="active" defaultChecked={promotion.active} /> Active</label>
                <div className="md:text-right"><button className="rounded-xl border px-5 py-3 font-bold">Update Promotion</button></div>
              </form>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
