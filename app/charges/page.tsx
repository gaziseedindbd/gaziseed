'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, MapPin, MessageCircle, PackageCheck, ShieldCheck, Truck, Globe2 } from 'lucide-react';
import { getVisitorCountry, setManualCountry, supabase } from '@/lib/supabase/client';

type Country = 'BD' | 'IN';
type ChargeRule = { id?: string; title: string; subtitle: string | null; charge: number; is_free: boolean; featured: boolean };
type CountrySettings = { country_code: Country; country_name: string; currency: 'BDT' | 'INR'; hero_title: string; hero_subtitle: string; delivery_time_primary_label: string; delivery_time_primary_value: string; delivery_time_secondary_label: string; delivery_time_secondary_value: string; notes: string[]; whatsapp_number: string | null };

const FALLBACK_SETTINGS: Record<Country, CountrySettings> = {
  BD: { country_code: 'BD', country_name: 'বাংলাদেশ', currency: 'BDT', hero_title: 'সহজ ও স্বচ্ছ ডেলিভারি চার্জ', hero_subtitle: 'আপনার অর্ডারের মোট মূল্যের ভিত্তিতে বাংলাদেশে প্রযোজ্য ডেলিভারি চার্জ এক নজরে দেখুন।', delivery_time_primary_label: 'ঢাকার ভিতরে', delivery_time_primary_value: '১ – ২ দিন', delivery_time_secondary_label: 'ঢাকার বাইরে', delivery_time_secondary_value: '২ – ৩ দিন', notes: ['ডেলিভারি চার্জ অর্ডারের মোট মূল্যের ভিত্তিতে নির্ধারিত হয়।', '৳৬০০ বা তার বেশি অর্ডারে ডেলিভারি সম্পূর্ণ ফ্রি।', 'অ্যাডমিন থেকে Free Delivery অফার চালু থাকলে চার্জ ৳০ হবে।'], whatsapp_number: null },
  IN: { country_code: 'IN', country_name: 'ভারত', currency: 'INR', hero_title: 'সহজ ও স্বচ্ছ ডেলিভারি চার্জ', hero_subtitle: 'আপনার অর্ডারের মোট মূল্যের ভিত্তিতে ভারতে প্রযোজ্য ডেলিভারি চার্জ এক নজরে দেখুন।', delivery_time_primary_label: 'মেট্রো / সিটি', delivery_time_primary_value: '২ – ৪ দিন', delivery_time_secondary_label: 'অন্যান্য এলাকা', delivery_time_secondary_value: '৪ – ৭ দিন', notes: ['ডেলিভারি চার্জ অর্ডারের মোট মূল্যের ভিত্তিতে নির্ধারিত হয়।', '₹১০০০ বা তার বেশি অর্ডারে ডেলিভারি সম্পূর্ণ ফ্রি।', 'অ্যাডমিন থেকে Free Delivery অফার চালু থাকলে চার্জ ₹০ হবে।'], whatsapp_number: null },
};

export default function ChargesPage() {
  const [country, setCountry] = useState<Country>('BD');
  const [settings, setSettings] = useState<CountrySettings | null>(null);
  const [rules, setRules] = useState<ChargeRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sync = () => setCountry(getVisitorCountry());
    sync(); window.addEventListener('gazi-country-changed', sync);
    return () => window.removeEventListener('gazi-country-changed', sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [settingsRes, rulesRes] = await Promise.all([
        supabase.from('delivery_country_settings').select('*').eq('country_code', country).eq('is_active', true).maybeSingle(),
        supabase.from('delivery_charge_rules').select('*').eq('country_code', country).eq('is_active', true).order('display_order', { ascending: true }),
      ]);
      if (cancelled) return;
      setSettings((settingsRes.data as CountrySettings | null) || FALLBACK_SETTINGS[country]);
      setRules((rulesRes.data as ChargeRule[] | null) || []);
      setLoading(false);
    };
    load(); return () => { cancelled = true; };
  }, [country]);

  const current = settings || FALLBACK_SETTINGS[country];
  const currencySign = current.currency === 'INR' ? '₹' : '৳';
  const whatsappNumber = current.whatsapp_number?.replace(/\D/g, '');
  const whatsappHref = whatsappNumber ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`${current.country_name}-এর ডেলিভারি চার্জ সম্পর্কে জানতে চাই।`)}` : null;
  const fallbackRules: ChargeRule[] = country === 'BD' ? [
    { title: 'অর্ডার ৳৬০০ বা তার বেশি', subtitle: 'আপনার অর্ডারের ডেলিভারি সম্পূর্ণ ফ্রি 🎉', charge: 0, is_free: true, featured: true },
    { title: 'অর্ডার ৳৪০০ – ৳৫৯৯', subtitle: 'সাশ্রয়ী ডেলিভারি চার্জ', charge: 50, is_free: false, featured: false },
    { title: 'অর্ডার ৳২০০ – ৳৩৯৯', subtitle: 'নিয়মিত ডেলিভারি চার্জ', charge: 70, is_free: false, featured: false },
    { title: 'অর্ডার ৳২০০ এর কম', subtitle: 'ছোট অর্ডারের জন্য প্রযোজ্য', charge: 120, is_free: false, featured: false },
  ] : [
    { title: 'অর্ডার ₹১০০০ বা তার বেশি', subtitle: 'আপনার অর্ডারের ডেলিভারি সম্পূর্ণ ফ্রি 🎉', charge: 0, is_free: true, featured: true },
    { title: 'অর্ডার ₹৬০০ – ₹৯৯৯', subtitle: 'সাশ্রয়ী ডেলিভারি চার্জ', charge: 99, is_free: false, featured: false },
    { title: 'অর্ডার ₹৩০০ – ₹৫৯৯', subtitle: 'নিয়মিত ডেলিভারি চার্জ', charge: 149, is_free: false, featured: false },
    { title: 'অর্ডার ₹৩০০ এর কম', subtitle: 'ছোট অর্ডারের জন্য প্রযোজ্য', charge: 199, is_free: false, featured: false },
  ];
  const visibleRules = rules.length ? rules : fallbackRules;
  const money = (value: number) => value === 0 ? 'ফ্রি' : `${currencySign}${value.toLocaleString(current.currency === 'INR' ? 'en-IN' : 'bn-BD')}`;

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/[0.05] via-background to-background">
      <div className="container-custom px-4 py-8 sm:py-10 lg:py-12"><div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-primary">Delivery Information</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">ডেলিভারি চার্জ</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">আপনার দেশের জন্য প্রযোজ্য চার্জ ও ডেলিভারি সময় এক জায়গায় দেখুন।</p></div>
          <div className="inline-flex w-fit items-center gap-1 rounded-2xl border border-primary/10 bg-card p-1.5 shadow-sm"><button type="button" onClick={() => setManualCountry('BD')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${country === 'BD' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary'}`}>🇧🇩 Bangladesh</button><button type="button" onClick={() => setManualCountry('IN')} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${country === 'IN' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary'}`}>🇮🇳 India</button></div>
        </div>

        <section className="relative overflow-hidden rounded-[2rem] border border-primary/10 bg-gradient-to-br from-emerald-900 via-emerald-800 to-primary px-6 py-8 text-white shadow-[0_28px_80px_-42px_hsl(var(--primary)/0.8)] sm:px-9 sm:py-10 lg:px-12"><div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" /><div className="pointer-events-none absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-lime-300/10 blur-3xl" /><div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold backdrop-blur"><Globe2 className="h-4 w-4" />{country === 'BD' ? '🇧🇩 বাংলাদেশ' : '🇮🇳 ভারত'}</div><h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{current.hero_title}</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-emerald-50 sm:text-base">{current.hero_subtitle}</p><div className="mt-6 flex flex-wrap gap-3">{whatsappHref && <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-emerald-800 shadow-lg transition hover:-translate-y-0.5"><MessageCircle className="h-5 w-5" />WhatsApp-এ জিজ্ঞাসা করুন</a>}<div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold backdrop-blur"><PackageCheck className="h-5 w-5" />নিরাপদ হোম ডেলিভারি</div></div></div><div className="hidden rounded-3xl border border-white/10 bg-white/10 p-5 backdrop-blur sm:block lg:w-64"><p className="text-xs font-semibold text-emerald-100">আপনার কারেন্সি</p><p className="mt-2 text-4xl font-black">{currencySign}</p><p className="mt-1 text-sm text-emerald-50">{current.currency === 'INR' ? 'Indian Rupee' : 'Bangladeshi Taka'}</p></div></div></section>

        <section className="mt-7 grid gap-6 lg:grid-cols-[1.55fr_1fr]"><div className="rounded-[2rem] border border-border/70 bg-card p-5 shadow-sm sm:p-7"><div className="mb-6 flex items-start gap-4"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Truck className="h-6 w-6" /></div><div><h2 className="text-xl font-extrabold sm:text-2xl">ডেলিভারি চার্জ তালিকা</h2><p className="mt-1 text-sm text-muted-foreground">অর্ডারের মোট মূল্য অনুযায়ী প্রযোজ্য চার্জ</p></div></div><div className="space-y-3">{loading ? [1,2,3,4].map((n) => <div key={n} className="h-20 animate-pulse rounded-2xl bg-secondary/70" />) : visibleRules.map((rule, index) => <div key={rule.id || index} className={`flex items-center justify-between gap-4 rounded-2xl border p-4 sm:px-5 sm:py-4 ${rule.featured ? 'border-primary/20 bg-primary/[0.06]' : 'border-border/70 bg-background/60'}`}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{rule.title}</h3>{rule.featured && <span className="rounded-full bg-primary px-2.5 py-1 text-[10px] font-extrabold text-primary-foreground">BEST VALUE</span>}</div><p className="mt-1 text-sm text-muted-foreground">{rule.subtitle}</p></div><div className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-extrabold ${rule.featured ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}>{rule.is_free ? 'ফ্রি' : money(rule.charge)}</div></div>)}</div></div>
          <div className="space-y-5"><div className="rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm sm:p-7"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600"><Clock3 className="h-5 w-5" /></div><h3 className="mt-4 text-lg font-extrabold">আনুমানিক ডেলিভারি সময়</h3><div className="mt-4 space-y-3 text-sm"><div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3.5"><span className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-primary" />{current.delivery_time_primary_label}</span><span className="font-extrabold">{current.delivery_time_primary_value}</span></div><div className="flex items-center justify-between rounded-2xl bg-secondary/60 px-4 py-3.5"><span className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4 text-primary" />{current.delivery_time_secondary_label}</span><span className="font-extrabold">{current.delivery_time_secondary_value}</span></div></div></div><div className="rounded-[2rem] border border-primary/10 bg-primary/[0.05] p-6 sm:p-7"><ShieldCheck className="h-8 w-8 text-primary" /><h3 className="mt-4 text-lg font-extrabold">স্বচ্ছ ও নির্ভরযোগ্য</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Checkout-এ আপনার country ও order value অনুযায়ী প্রযোজ্য delivery charge automatically হিসাব করা হবে।</p></div></div></section>

        <section className="mt-7 rounded-[2rem] border border-border/70 bg-card p-6 shadow-sm sm:p-8"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Check className="h-5 w-5" /></div><div className="min-w-0"><h2 className="text-xl font-extrabold">গুরুত্বপূর্ণ তথ্য</h2><ul className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground sm:grid-cols-2">{current.notes.map((note, index) => <li key={index}>• {note}</li>)}</ul></div></div></section>
      </div></div>
    </main>
  );
}
