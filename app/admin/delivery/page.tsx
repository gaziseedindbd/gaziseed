'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Edit, Trash2, X, Truck, Globe2, Plus, Save, Clock3, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

type Country = 'BD' | 'IN';

type ChargeRule = {
  id: string;
  country_code: Country;
  title: string;
  subtitle: string | null;
  min_order: number | null;
  max_order: number | null;
  charge: number;
  currency: 'BDT' | 'INR';
  is_free: boolean;
  featured: boolean;
  display_order: number;
  is_active: boolean;
};

type CountrySettings = {
  country_code: Country;
  country_name: string;
  currency: 'BDT' | 'INR';
  hero_title: string;
  hero_subtitle: string;
  delivery_time_primary_label: string;
  delivery_time_primary_value: string;
  delivery_time_secondary_label: string;
  delivery_time_secondary_value: string;
  notes: string[];
  whatsapp_number: string | null;
  is_active: boolean;
};

const emptyRule = (country: Country): Partial<ChargeRule> => ({
  country_code: country,
  title: '', subtitle: '', min_order: 0, max_order: null, charge: 0,
  currency: country === 'IN' ? 'INR' : 'BDT', is_free: false, featured: false,
  display_order: 1, is_active: true,
});

export default function AdminDeliveryPage() {
  const [country, setCountry] = useState<Country>('BD');
  const [tab, setTab] = useState<'charges' | 'zones'>('charges');
  const [rules, setRules] = useState<ChargeRule[]>([]);
  const [settings, setSettings] = useState<CountrySettings | null>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<Partial<ChargeRule> | null>(null);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [showZoneForm, setShowZoneForm] = useState(false);

  useEffect(() => {
    const sync = () => {
      const saved = localStorage.getItem('gazi_admin_branch');
      if (saved === 'BD' || saved === 'IN') setCountry(saved);
    };
    sync();
    window.addEventListener('gazi-branch-change', sync);
    return () => window.removeEventListener('gazi-branch-change', sync);
  }, []);

  useEffect(() => { loadData(); }, [country]);

  const loadData = async () => {
    setLoading(true);
    const [r, s, z] = await Promise.all([
      supabase.from('delivery_charge_rules').select('*').eq('country_code', country).order('display_order', { ascending: true }),
      supabase.from('delivery_country_settings').select('*').eq('country_code', country).maybeSingle(),
      supabase.from('delivery_zones').select('*').eq('country_code', country).order('display_order', { ascending: true }),
    ]);
    setRules((r.data as ChargeRule[]) || []);
    setSettings((s.data as CountrySettings | null) || null);
    setZones(z.data || []);
    setLoading(false);
  };

  const saveRule = async () => {
    if (!editingRule?.title?.trim()) return toast('Rule-এর নাম দিন', 'error');
    const payload = {
      ...editingRule,
      country_code: country,
      currency: country === 'IN' ? 'INR' : 'BDT',
      min_order: editingRule.is_free ? (editingRule.min_order ?? 0) : Number(editingRule.min_order ?? 0),
      max_order: editingRule.max_order === null || editingRule.max_order === undefined || String(editingRule.max_order) === '' ? null : Number(editingRule.max_order),
      charge: editingRule.is_free ? 0 : Number(editingRule.charge ?? 0),
      display_order: Number(editingRule.display_order ?? 0),
      is_free: !!editingRule.is_free,
      featured: !!editingRule.featured,
      is_active: editingRule.is_active !== false,
    };
    const result = editingRule.id
      ? await supabase.from('delivery_charge_rules').update(payload).eq('id', editingRule.id)
      : await supabase.from('delivery_charge_rules').insert(payload);
    if (result.error) return toast('চার্জ rule save হয়নি', 'error');
    toast('ডেলিভারি চার্জ আপডেট হয়েছে');
    setEditingRule(null); loadData();
  };

  const deleteRule = async (id: string) => {
    if (!confirm('এই delivery charge rule মুছতে চান?')) return;
    const { error } = await supabase.from('delivery_charge_rules').delete().eq('id', id);
    if (error) return toast('মুছতে সমস্যা হয়েছে', 'error');
    toast('Rule মুছে ফেলা হয়েছে'); loadData();
  };

  const saveSettings = async () => {
    if (!settings) return;
    const { error } = await supabase.from('delivery_country_settings').update({
      country_name: settings.country_name,
      hero_title: settings.hero_title,
      hero_subtitle: settings.hero_subtitle,
      delivery_time_primary_label: settings.delivery_time_primary_label,
      delivery_time_primary_value: settings.delivery_time_primary_value,
      delivery_time_secondary_label: settings.delivery_time_secondary_label,
      delivery_time_secondary_value: settings.delivery_time_secondary_value,
      notes: settings.notes,
      whatsapp_number: settings.whatsapp_number || null,
      currency: settings.currency,
      is_active: settings.is_active,
      updated_at: new Date().toISOString(),
    }).eq('country_code', country);
    if (error) return toast('Country settings save হয়নি', 'error');
    toast('Country settings save হয়েছে'); loadData();
  };

  const saveZone = async (formData: any) => {
    const payload = { ...formData, country_code: country, charge: Number(formData.charge), display_order: Number(formData.display_order) };
    const result = editingZone?.id
      ? await supabase.from('delivery_zones').update(payload).eq('id', editingZone.id)
      : await supabase.from('delivery_zones').insert(payload);
    if (result.error) return toast('Delivery zone save হয়নি', 'error');
    toast(editingZone ? 'Delivery zone আপডেট হয়েছে' : 'Delivery zone যোগ হয়েছে');
    setShowZoneForm(false); setEditingZone(null); loadData();
  };

  const deleteZone = async (id: string) => {
    if (!confirm('এই delivery zone মুছতে চান?')) return;
    const { error } = await supabase.from('delivery_zones').delete().eq('id', id);
    if (error) return toast('মুছতে সমস্যা হয়েছে', 'error');
    toast('Delivery zone মুছে ফেলা হয়েছে'); loadData();
  };

  const currency = country === 'IN' ? '₹' : '৳';
  const countryLabel = country === 'IN' ? '🇮🇳 India' : '🇧🇩 Bangladesh';

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Delivery Management</p><h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">ডেলিভারি সেটিংস</h1><p className="mt-1 text-sm text-muted-foreground">বাংলাদেশ ও ভারতের delivery charge আলাদাভাবে manage করুন।</p></div>
        <div className="inline-flex w-fit items-center gap-1 rounded-2xl border border-primary/10 bg-card p-1.5 shadow-sm"><button onClick={() => setCountry('BD')} className={`rounded-xl px-4 py-2 text-sm font-bold ${country === 'BD' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>🇧🇩 Bangladesh</button><button onClick={() => setCountry('IN')} className={`rounded-xl px-4 py-2 text-sm font-bold ${country === 'IN' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary'}`}>🇮🇳 India</button></div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm"><button onClick={() => setTab('charges')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${tab === 'charges' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}><Truck className="h-4 w-4" /> Charge Rules</button><button onClick={() => setTab('zones')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${tab === 'zones' ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'}`}><Globe2 className="h-4 w-4" /> Delivery Zones</button></div>

      {loading ? <div className="h-72 animate-pulse rounded-3xl bg-secondary/60" /> : tab === 'charges' ? (
        <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <div className="mb-5 flex items-center justify-between gap-4"><div><h2 className="text-xl font-extrabold">{countryLabel} — Charge Rules</h2><p className="mt-1 text-sm text-muted-foreground">Order value অনুযায়ী charge, free delivery ও display order control করুন।</p></div><button onClick={() => setEditingRule(emptyRule(country))} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> নতুন Rule</button></div>
            <div className="space-y-3">{rules.length === 0 ? <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">কোনো charge rule নেই</div> : rules.map((rule) => <div key={rule.id} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold">{rule.title}</p>{rule.featured && <span className="rounded-full bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">FEATURED</span>}{!rule.is_active && <span className="rounded-full bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive">OFF</span>}</div><p className="mt-1 text-sm text-muted-foreground">{rule.subtitle}</p><p className="mt-2 text-xs text-muted-foreground">Order: {rule.min_order ?? 0}{rule.max_order !== null ? ` – ${rule.max_order}` : '+'} • Charge: <span className="font-bold text-foreground">{rule.is_free ? 'FREE' : `${currency}${Number(rule.charge).toLocaleString(country === 'IN' ? 'en-IN' : 'en-US')}`}</span></p></div><div className="flex shrink-0 gap-2"><button onClick={() => setEditingRule(rule)} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-secondary"><Edit className="h-4 w-4" /> Edit</button><button onClick={() => deleteRule(rule.id)} className="rounded-xl border border-destructive/20 p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
          </section>

          <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="mb-5 flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Clock3 className="h-5 w-5" /></div><div><h2 className="text-xl font-extrabold">Country Settings</h2><p className="text-sm text-muted-foreground">Public charges page-এর content</p></div></div>{settings ? <div className="space-y-4"><Field label="Country Name"><input className="input-bangla" value={settings.country_name} onChange={(e) => setSettings({ ...settings, country_name: e.target.value })} /></Field><Field label="Hero Title"><input className="input-bangla" value={settings.hero_title} onChange={(e) => setSettings({ ...settings, hero_title: e.target.value })} /></Field><Field label="Hero Subtitle"><textarea className="input-bangla min-h-24" value={settings.hero_subtitle} onChange={(e) => setSettings({ ...settings, hero_subtitle: e.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Time 1 Label"><input className="input-bangla" value={settings.delivery_time_primary_label} onChange={(e) => setSettings({ ...settings, delivery_time_primary_label: e.target.value })} /></Field><Field label="Time 1 Value"><input className="input-bangla" value={settings.delivery_time_primary_value} onChange={(e) => setSettings({ ...settings, delivery_time_primary_value: e.target.value })} /></Field><Field label="Time 2 Label"><input className="input-bangla" value={settings.delivery_time_secondary_label} onChange={(e) => setSettings({ ...settings, delivery_time_secondary_label: e.target.value })} /></Field><Field label="Time 2 Value"><input className="input-bangla" value={settings.delivery_time_secondary_value} onChange={(e) => setSettings({ ...settings, delivery_time_secondary_value: e.target.value })} /></Field></div><Field label="WhatsApp Number"><input className="input-bangla" value={settings.whatsapp_number || ''} onChange={(e) => setSettings({ ...settings, whatsapp_number: e.target.value })} placeholder="8801..." /></Field><div className="flex items-center justify-between rounded-2xl bg-secondary/60 p-3"><div><p className="font-semibold">Public display</p><p className="text-xs text-muted-foreground">এই country-এর charges page active থাকবে</p></div><input type="checkbox" checked={settings.is_active} onChange={(e) => setSettings({ ...settings, is_active: e.target.checked })} className="h-5 w-5 accent-primary" /></div><button onClick={saveSettings} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"><Save className="h-4 w-4" /> Country Settings Save</button></div> : <div className="text-sm text-muted-foreground">Settings পাওয়া যায়নি।</div>}</section>
        </div>
      ) : (
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-extrabold">{countryLabel} — Delivery Zones</h2><p className="mt-1 text-sm text-muted-foreground">Country অনুযায়ী zone charge ও COD manage করুন।</p></div><button onClick={() => { setEditingZone(null); setShowZoneForm(true); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus className="h-4 w-4" /> নতুন Zone</button></div><div className="overflow-x-auto rounded-2xl border border-border"><table className="w-full text-sm"><thead><tr className="border-b border-border bg-secondary/30 text-left"><th className="p-3">Zone</th><th className="p-3">Charge</th><th className="p-3">Time</th><th className="p-3">COD</th><th className="p-3">Status</th><th className="p-3"></th></tr></thead><tbody>{zones.map((z) => <tr key={z.id} className="border-b border-border/50"><td className="p-3 font-semibold">{z.zone_name}</td><td className="p-3 font-bold">{currency}{Number(z.charge).toLocaleString(country === 'IN' ? 'en-IN' : 'en-US')}</td><td className="p-3 text-muted-foreground">{z.estimated_time}</td><td className="p-3">{z.cod_enabled ? 'হ্যাঁ' : 'না'}</td><td className="p-3">{z.is_active ? 'সক্রিয়' : 'বন্ধ'}</td><td className="p-3"><div className="flex gap-2"><button onClick={() => { setEditingZone(z); setShowZoneForm(true); }} className="rounded-lg border border-border p-2"><Edit className="h-4 w-4" /></button><button onClick={() => deleteZone(z.id)} className="rounded-lg border border-destructive/20 p-2 text-destructive"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table>{zones.length === 0 && <p className="p-8 text-center text-muted-foreground">কোনো zone নেই</p>}</div></section>
      )}

      {editingRule && <RuleModal rule={editingRule} currency={currency} onChange={setEditingRule} onSave={saveRule} onClose={() => setEditingRule(null)} />}
      {showZoneForm && <ZoneModal zone={editingZone} onSave={saveZone} onClose={() => { setShowZoneForm(false); setEditingZone(null); }} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div><label className="mb-1.5 block text-xs font-bold text-muted-foreground">{label}</label>{children}</div>; }
function RuleModal({ rule, currency, onChange, onSave, onClose }: any) { return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} /><div className="relative z-10 max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-background p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-extrabold">{rule.id ? 'Charge Rule Edit' : 'নতুন Charge Rule'}</h2><p className="mt-1 text-xs text-muted-foreground">{currency} currency automatically selected</p></div><button onClick={onClose}><X className="h-5 w-5" /></button></div><div className="space-y-4"><Field label="Rule Title"><input className="input-bangla" value={rule.title || ''} onChange={(e) => onChange({ ...rule, title: e.target.value })} placeholder="অর্ডার ৳৬০০ বা তার বেশি" /></Field><Field label="Subtitle"><input className="input-bangla" value={rule.subtitle || ''} onChange={(e) => onChange({ ...rule, subtitle: e.target.value })} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label={`Minimum Order (${currency})`}><input type="number" className="input-bangla" value={rule.min_order ?? 0} onChange={(e) => onChange({ ...rule, min_order: e.target.value })} /></Field><Field label={`Maximum Order (${currency}, blank = no limit)`}><input type="number" className="input-bangla" value={rule.max_order ?? ''} onChange={(e) => onChange({ ...rule, max_order: e.target.value === '' ? null : e.target.value })} /></Field><Field label={`Delivery Charge (${currency})`}><input type="number" className="input-bangla" value={rule.charge ?? 0} disabled={rule.is_free} onChange={(e) => onChange({ ...rule, charge: e.target.value })} /></Field><Field label="Display Order"><input type="number" className="input-bangla" value={rule.display_order ?? 0} onChange={(e) => onChange({ ...rule, display_order: e.target.value })} /></Field></div><div className="grid gap-3 sm:grid-cols-3"><label className="flex items-center gap-2 rounded-xl bg-secondary/60 p-3 text-sm font-semibold"><input type="checkbox" checked={!!rule.is_free} onChange={(e) => onChange({ ...rule, is_free: e.target.checked, charge: e.target.checked ? 0 : rule.charge })} className="accent-primary" /> Free Delivery</label><label className="flex items-center gap-2 rounded-xl bg-secondary/60 p-3 text-sm font-semibold"><input type="checkbox" checked={!!rule.featured} onChange={(e) => onChange({ ...rule, featured: e.target.checked })} className="accent-primary" /> Featured</label><label className="flex items-center gap-2 rounded-xl bg-secondary/60 p-3 text-sm font-semibold"><input type="checkbox" checked={rule.is_active !== false} onChange={(e) => onChange({ ...rule, is_active: e.target.checked })} className="accent-primary" /> Active</label></div><button onClick={onSave} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-bold text-primary-foreground"><Save className="h-4 w-4" /> Save Rule</button></div></div></div>; }
function ZoneModal({ zone, onSave, onClose }: any) { const [form, setForm] = useState({ zone_name: zone?.zone_name || '', charge: zone?.charge || 0, estimated_time: zone?.estimated_time || '', cod_enabled: zone?.cod_enabled ?? true, is_active: zone?.is_active ?? true, display_order: zone?.display_order || 0 }); return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/55" onClick={onClose} /><form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="relative z-10 w-full max-w-md space-y-4 rounded-3xl bg-background p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-extrabold">{zone ? 'Zone Edit' : 'নতুন Zone'}</h2><button type="button" onClick={onClose}><X className="h-5 w-5" /></button></div><Field label="Zone Name"><input className="input-bangla" value={form.zone_name} onChange={(e) => setForm({ ...form, zone_name: e.target.value })} required /></Field><Field label="Charge"><input type="number" className="input-bangla" value={form.charge} onChange={(e) => setForm({ ...form, charge: e.target.value })} required /></Field><Field label="Estimated Time"><input className="input-bangla" value={form.estimated_time} onChange={(e) => setForm({ ...form, estimated_time: e.target.value })} /></Field><Field label="Display Order"><input type="number" className="input-bangla" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.cod_enabled} onChange={(e) => setForm({ ...form, cod_enabled: e.target.checked })} className="accent-primary" /> COD active</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-primary" /> Active</label><button className="w-full rounded-xl bg-primary py-3 font-bold text-primary-foreground">Save Zone</button></form></div>; }
