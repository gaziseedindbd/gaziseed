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

function toInputDate(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

export async function saveCampaign(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  const name = text(formData, 'name');
  const country = text(formData, 'country') || 'BD';
  const platform = text(formData, 'platform');
  const source = text(formData, 'source');
  const medium = text(formData, 'medium');
  const campaignCode = text(formData, 'campaign_code');
  const landingPageId = text(formData, 'landing_page_id');
  const budget = numberValue(formData, 'budget');
  const startsAt = dateValue(formData, 'starts_at');
  const endsAt = dateValue(formData, 'ends_at');
  const active = formData.get('active') === 'on';

  if (!name) throw new Error('Campaign name is required.');
  if (!platform) throw new Error('Platform is required.');
  if (budget !== null && budget < 0) throw new Error('Budget cannot be negative.');

  const payload = {
    country: country === 'IN' ? 'IN' : 'BD',
    name,
    platform,
    source: nullable(source),
    medium: nullable(medium),
    campaign_code: nullable(campaignCode),
    landing_page_id: nullable(landingPageId),
    budget,
    starts_at: startsAt,
    ends_at: endsAt,
    active,
  };

  const result = id
    ? await supabase.from('campaigns').update(payload).eq('id', id)
    : await supabase.from('campaigns').insert(payload);

  if (result.error) throw new Error(result.error.message);
  revalidatePath('/admin/cms/campaigns');
}

export async function deleteCampaign(formData: FormData) {
  const supabase = await requireMasterAdmin();
  const id = text(formData, 'id');
  if (!id) throw new Error('Campaign id is required.');
  const { error } = await supabase.from('campaigns').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/admin/cms/campaigns');
}

export default async function CampaignsCmsPage() {
  const supabase = await requireMasterAdmin();
  const [{ data: campaigns, error: campaignsError }, { data: landingPages, error: landingError }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id,country,name,platform,source,medium,campaign_code,landing_page_id,budget,starts_at,ends_at,active,created_at')
      .order('created_at', { ascending: false }),
    supabase.from('landing_pages').select('id,title,slug,country,active').order('title').limit(500),
  ]);

  if (campaignsError) return <main className="p-6 text-red-600">Unable to load campaigns: {campaignsError.message}</main>;
  if (landingError) return <main className="p-6 text-red-600">Unable to load landing pages: {landingError.message}</main>;

  const form = (campaign?: any) => (
    <form action={saveCampaign} className="grid gap-3 md:grid-cols-2">
      {campaign && <input type="hidden" name="id" value={campaign.id} />}
      <input name="name" defaultValue={campaign?.name ?? ''} placeholder="Campaign name" className="rounded-xl border p-3 md:col-span-2" />
      <select name="country" defaultValue={campaign?.country ?? 'BD'} className="rounded-xl border p-3"><option value="BD">Bangladesh</option><option value="IN">India</option></select>
      <input name="platform" defaultValue={campaign?.platform ?? ''} placeholder="Platform (Meta, Google, YouTube...)" className="rounded-xl border p-3" />
      <input name="source" defaultValue={campaign?.source ?? ''} placeholder="Source (facebook, google...)" className="rounded-xl border p-3" />
      <input name="medium" defaultValue={campaign?.medium ?? ''} placeholder="Medium (paid, organic...)" className="rounded-xl border p-3" />
      <input name="campaign_code" defaultValue={campaign?.campaign_code ?? ''} placeholder="Campaign code" className="rounded-xl border p-3" />
      <select name="landing_page_id" defaultValue={campaign?.landing_page_id ?? ''} className="rounded-xl border p-3 md:col-span-2">
        <option value="">No landing page</option>
        {(landingPages ?? []).map((page) => <option key={page.id} value={page.id}>{page.title} · /{page.slug} · {page.country}</option>)}
      </select>
      <input name="budget" type="number" min="0" step="0.01" defaultValue={campaign?.budget ?? ''} placeholder="Budget" className="rounded-xl border p-3" />
      <div className="flex items-center gap-2 rounded-xl border p-3"><input type="checkbox" name="active" defaultChecked={campaign ? campaign.active : true} /><span className="font-bold">Active</span></div>
      <label className="text-sm font-bold">Start<input name="starts_at" type="datetime-local" defaultValue={toInputDate(campaign?.starts_at ?? null)} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
      <label className="text-sm font-bold">End<input name="ends_at" type="datetime-local" defaultValue={toInputDate(campaign?.ends_at ?? null)} className="mt-1 w-full rounded-xl border p-3 font-normal" /></label>
      <button className="rounded-xl bg-[#1f6b3b] px-5 py-3 font-bold text-white md:col-span-2">{campaign ? 'Update Campaign' : 'Save Campaign'}</button>
    </form>
  );

  return (
    <main className="p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <Link href="/admin/cms" className="text-sm font-bold text-[#1f6b3b]">← CMS & Marketing</Link>
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.2em] text-[#1f6b3b]">SEED BARI CMS</p>
        <h1 className="mt-1 text-3xl font-black">Campaign Management</h1>
        <p className="mt-2 text-gray-500">Manage acquisition platforms, UTM-style source data, budgets and landing-page links.</p>

        <section className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Create campaign</h2>
          <div className="mt-5">{form()}</div>
        </section>

        <section className="mt-8 space-y-5">
          {(campaigns ?? []).map((campaign) => (
            <article key={campaign.id} className="rounded-2xl border bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{campaign.name}</h2>
                  <p className="mt-1 text-sm text-gray-500">{campaign.platform} · {campaign.country} · {campaign.active ? 'Active' : 'Inactive'}{campaign.campaign_code ? ` · ${campaign.campaign_code}` : ''}</p>
                </div>
                <form action={deleteCampaign}><input type="hidden" name="id" value={campaign.id} /><button className="rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-600">Delete</button></form>
              </div>
              <div className="mt-5">{form(campaign)}</div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}
