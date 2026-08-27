'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { toast } from '@/components/site/toast-provider';
import { Save, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react';

export default function AdminHomepagePage() {
  const [sections, setSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadSections(); }, []);

  const loadSections = async () => {
    const { data } = await supabase.from('homepage_sections').select('*').order('display_order');
    setSections(data || []);
    setLoading(false);
  };

  const toggleSection = async (s: any) => {
    await supabase.from('homepage_sections').update({ is_enabled: !s.is_enabled }).eq('id', s.id);
    toast(s.is_enabled ? 'সেকশন বন্ধ হয়েছে' : 'সেকশন চালু হয়েছে');
    loadSections();
  };

  const updateTitle = async (id: string, title: string, subtitle: string) => {
    await supabase.from('homepage_sections').update({ title, subtitle }).eq('id', id);
  };

  const moveOrder = async (section: any, direction: 'up' | 'down') => {
    const sorted = [...sections].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((s) => s.id === section.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swapItem = sorted[swapIdx];
    await supabase.from('homepage_sections').update({ display_order: swapItem.display_order }).eq('id', section.id);
    await supabase.from('homepage_sections').update({ display_order: section.display_order }).eq('id', swapItem.id);
    loadSections();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">হোমপেজ ম্যানেজমেন্ট</h1>
      <p className="mb-4 text-sm text-muted-foreground">হোমপেজের সেকশনগুলো চালু/বন্ধ করুন, টাইটেল পরিবর্তন করুন এবং সাজান।</p>

      <div className="space-y-2">
        {sections.map((s, idx) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-col">
              <button onClick={() => moveOrder(s, 'up')} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
              <button onClick={() => moveOrder(s, 'down')} disabled={idx === sections.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
            </div>
            <div className="flex-1">
              <input value={s.title || ''} onChange={(e) => setSections(sections.map((item) => item.id === s.id ? { ...item, title: e.target.value } : item))} onBlur={(e) => updateTitle(s.id, e.target.value, s.subtitle)} className="w-full rounded-lg border border-input px-3 py-2 text-sm font-medium" placeholder={s.section_key} />
              <input value={s.subtitle || ''} onChange={(e) => setSections(sections.map((item) => item.id === s.id ? { ...item, subtitle: e.target.value } : item))} onBlur={(e) => updateTitle(s.id, s.title, e.target.value)} className="mt-1 w-full rounded-lg border border-input px-3 py-1.5 text-xs text-muted-foreground" placeholder="সাবটাইটেল" />
            </div>
            <button onClick={() => toggleSection(s)} className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium ${s.is_enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
              {s.is_enabled ? <><Eye className="h-4 w-4" /> চালু</> : <><EyeOff className="h-4 w-4" /> বন্ধ</>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
