'use client';

import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/lib/data';
import { supabase } from '@/lib/supabase/client';
import type { SiteSettings } from '@/lib/supabase/types';
import { Phone, Mail, MapPin, Clock, Send, MessageCircle, Sprout, ShieldCheck } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';
import { useLang } from '@/components/site/language-provider';

export default function ContactPage() {
  const { t } = useLang();
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });

  useEffect(() => {
    let cancelled = false;
    getSiteSettings()
      .then((value) => { if (!cancelled) setSettings(value); })
      .catch(() => { if (!cancelled) setSettings(null); })
      .finally(() => { if (!cancelled) setSettingsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.message) {
      toast(t('সব প্রয়োজনীয় তথ্য পূরণ করুন', 'Please fill in all required fields'), 'error');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('contact_messages').insert({
        name: form.name, phone: form.phone, email: form.email, message: form.message,
      });
      if (error) throw error;
      toast(t('বার্তা পাঠানো হয়েছে! আমরা শীঘ্রই যোগাযোগ করব।', 'Message sent! We will contact you soon.'));
      setForm({ name: '', phone: '', email: '', message: '' });
    } catch {
      toast(t('বার্তা পাঠাতে সমস্যা হয়েছে', 'There was a problem sending your message'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const phone = '+916002786881';
  const whatsapp = settings?.whatsapp;
  const email = 'help@gaziseed.com';
  const address = 'Damra Road, Dudhnoi, Assam 783126, India';
  const businessHours = '24x7 Support';
  const contacts = [
    { Icon: Phone, title: t('ফোন', 'Phone'), value: phone, href: 'tel:' + phone },
    { Icon: MessageCircle, title: 'WhatsApp', value: whatsapp, href: whatsapp ? 'https://wa.me/' + whatsapp.replace(/[^0-9]/g, '') : undefined },
    { Icon: Mail, title: t('ইমেইল', 'Email'), value: email, href: 'mailto:' + email },
    { Icon: MapPin, title: t('ঠিকানা', 'Address'), value: address },
    { Icon: Clock, title: t('সাপোর্ট সময়', 'Support Hours'), value: businessHours },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary/[0.025] via-background to-background">
      <section className="relative isolate overflow-hidden border-b border-primary/10 bg-gradient-to-br from-primary/[0.12] via-background to-amber-400/[0.08]">
        <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-24 -top-8 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="container-custom relative py-12 text-center sm:py-16">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/85 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary shadow-sm">
            <Sprout className="h-3.5 w-3.5" /> GAZI SEED • CUSTOMER CARE
          </span>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{t('কীভাবে সাহায্য করতে পারি?', 'How can we help you?')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {t('পণ্য, অর্ডার, বীজ নির্বাচন বা চাষাবাদ নিয়ে প্রশ্ন থাকলে আমাদের সঙ্গে সরাসরি যোগাযোগ করুন।', 'Contact us directly if you have questions about products, orders, seed selection, or growing advice.')}
          </p>
        </div>
      </section>

      <section className="container-custom py-9 sm:py-12">
        <div className="grid gap-7 lg:grid-cols-[.85fr_1.15fr]">
          <div>
            <div className="mb-5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t('যোগাযোগের মাধ্যম', 'CONTACT OPTIONS')}</p>
              <h2 className="mt-1 text-2xl font-black sm:text-3xl">{t('সরাসরি যোগাযোগ', 'Direct Contact')}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('আপনার সুবিধামতো যেকোনো মাধ্যমে আমাদের জানান।', 'Reach us through whichever channel is convenient for you.')}</p>
            </div>
            <div className="space-y-3" aria-live="polite">
              {!settingsLoaded ? Array.from({ length: 5 }).map((_, index) => (
                <div key={index} aria-hidden="true" className="flex min-h-[76px] animate-pulse items-center gap-3 rounded-[1.5rem] border border-border/70 bg-card p-4">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-secondary" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-24 rounded bg-secondary" /><div className="h-3 w-40 max-w-full rounded bg-secondary" /></div>
                </div>
              )) : contacts.filter((contact) => contact.value).map(({ Icon, title, value, href }) => (
                <div key={title} className="group flex items-start gap-3 rounded-[1.5rem] border border-border/70 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <h3 className="font-black">{title}</h3>
                    {href ? <a href={href} target={href.startsWith('http') ? '_blank' : undefined} rel={href.startsWith('http') ? 'noopener noreferrer' : undefined} className="mt-0.5 block break-words text-sm leading-6 text-muted-foreground hover:text-primary">{value}</a> : <p className="mt-0.5 text-sm leading-6 text-muted-foreground">{value}</p>}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-start gap-3 rounded-[1.5rem] border border-primary/10 bg-primary/[0.05] p-4 text-xs font-semibold leading-5 text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              {t('আপনার বার্তা আমাদের কাস্টমার কেয়ার টিমের কাছে নিরাপদভাবে পৌঁছাবে।', 'Your message will be sent securely to our customer care team.')}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-card p-5 shadow-[0_24px_70px_-35px_hsl(var(--primary)/0.45)] sm:p-8">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
            <div className="relative">
              <div className="mb-6">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">{t('বার্তা পাঠান', 'SEND A MESSAGE')}</p>
                <h2 className="mt-1 text-2xl font-black sm:text-3xl">{t('বার্তা পাঠান', 'Send a Message')}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t('আপনার প্রশ্ন বা প্রয়োজনীয় তথ্য লিখুন। আমরা যত দ্রুত সম্ভব যোগাযোগ করব।', 'Write your question or details. We will get back to you as soon as possible.')}</p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className="mb-1.5 block text-sm font-bold">{t('নাম', 'Name')} *</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-bangla h-12 w-full rounded-xl" required /></div>
                  <div><label className="mb-1.5 block text-sm font-bold">{t('মোবাইল নম্বর', 'Phone Number')} *</label><input type="tel" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-bangla h-12 w-full rounded-xl" required /></div>
                </div>
                <div><label className="mb-1.5 block text-sm font-bold">{t('ইমেইল', 'Email')} <span className="font-normal text-muted-foreground">({t('ঐচ্ছিক', 'Optional')})</span></label><input type="email" inputMode="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-bangla h-12 w-full rounded-xl" /></div>
                <div><label className="mb-1.5 block text-sm font-bold">{t('বার্তা', 'Message')} *</label><textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-bangla min-h-[150px] w-full resize-y rounded-xl" required /></div>
                <button type="submit" disabled={loading} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-black text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <Send className="h-4 w-4" />{loading ? t('পাঠানো হচ্ছে...', 'Sending...') : t('বার্তা পাঠান', 'Send Message')}
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
