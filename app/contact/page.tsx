'use client';

import { useEffect, useState } from 'react';
import { getSiteSettings } from '@/lib/data';
import { supabase } from '@/lib/supabase/client';
import type { SiteSettings } from '@/lib/supabase/types';
import { Phone, Mail, MapPin, Clock, Send } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function ContactPage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });

  useEffect(() => { getSiteSettings().then(setSettings); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.message) { toast('সব প্রয়োজনীয় তথ্য পূরণ করুন', 'error'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.from('contact_messages').insert({
        name: form.name,
        phone: form.phone,
        email: form.email,
        message: form.message,
      });
      if (error) throw error;
      toast('বার্তা পাঠানো হয়েছে! আমরা শীঘ্রই যোগাযোগ করব।');
      setForm({ name: '', phone: '', email: '', message: '' });
    } catch {
      toast('বার্তা পাঠাতে সমস্যা হয়েছে', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-custom py-6">
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">যোগাযোগ</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Contact info */}
        <div className="space-y-4">
          {settings?.phone && (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Phone className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">ফোন</h3>
                <a href={`tel:${settings.phone}`} className="text-sm text-muted-foreground hover:text-primary">{settings.phone}</a>
              </div>
            </div>
          )}
          {settings?.whatsapp && (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Phone className="mt-0.5 h-5 w-5 text-green-500" />
              <div>
                <h3 className="font-medium">WhatsApp</h3>
                <a href={`https://wa.me/${settings.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="text-sm text-muted-foreground hover:text-primary">{settings.whatsapp}</a>
              </div>
            </div>
          )}
          {settings?.email && (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Mail className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">ইমেইল</h3>
                <a href={`mailto:${settings.email}`} className="text-sm text-muted-foreground hover:text-primary">{settings.email}</a>
              </div>
            </div>
          )}
          {settings?.address && (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <MapPin className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">ঠিকানা</h3>
                <p className="text-sm text-muted-foreground">{settings.address}</p>
              </div>
            </div>
          )}
          {settings?.business_hours && (
            <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4">
              <Clock className="mt-0.5 h-5 w-5 text-primary" />
              <div>
                <h3 className="font-medium">ব্যবসায়িক সময়</h3>
                <p className="text-sm text-muted-foreground">{settings.business_hours}</p>
              </div>
            </div>
          )}
        </div>

        {/* Contact form */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-bold">বার্তা পাঠান</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">নাম *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-bangla" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">মোবাইল নম্বর *</label>
              <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input-bangla" required />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">ইমেইল (ঐচ্ছিক)</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input-bangla" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">বার্তা *</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="input-bangla min-h-[120px]" required />
            </div>
            <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              <Send className="h-4 w-4" />
              {loading ? 'পাঠানো হচ্ছে...' : 'বার্তা পাঠান'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
