'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Mail, Trash2, Check, Send } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});

  useEffect(() => { loadMessages(); }, []);

  const loadMessages = async () => {
    const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false });
    setMessages(data || []);
    setLoading(false);
  };

  const markRead = async (id: string) => {
    await supabase.from('contact_messages').update({ is_read: true }).eq('id', id);
    loadMessages();
  };

  const sendReply = async (id: string) => {
    const reply = replyText[id]?.trim();
    if (!reply) { toast('উত্তর লিখুন', 'error'); return; }
    const { error } = await supabase.from('contact_messages').update({ admin_reply: reply, replied_at: new Date().toISOString(), is_read: true }).eq('id', id);
    if (error) { toast('উত্তর পাঠানো ব্যর্থ', 'error'); return; }
    setReplyText({ ...replyText, [id]: '' });
    toast('উত্তর সংরক্ষণ করা হয়েছে');
    loadMessages();
  };

  const remove = async (id: string) => {
    await supabase.from('contact_messages').delete().eq('id', id);
    toast('মেসেজ মুছে ফেলা হয়েছে');
    loadMessages();
  };

  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">মেসেজ</h1>
      <div className="space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`rounded-2xl border border-border bg-card p-4 ${!m.is_read ? 'border-primary/30 bg-primary/5' : ''}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{m.name}</p>
                  {!m.is_read && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">নতুন</span>}
                  {m.admin_reply && <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">উত্তর দেওয়া হয়েছে</span>}
                </div>
                <p className="text-sm text-muted-foreground">{m.phone} {m.email && `• ${m.email}`}</p>
                <p className="mt-2 text-sm">{m.message}</p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString('bn-BD')}</p>
                {m.admin_reply && (
                  <div className="mt-2 rounded-lg bg-primary/5 p-2 text-sm">
                    <p className="text-xs font-medium text-primary">এডমিন উত্তর:</p>
                    <p>{m.admin_reply}</p>
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                {!m.is_read && <button onClick={() => markRead(m.id)} className="rounded p-2 text-green-600 hover:bg-green-50" title="পঠিত"><Check className="h-4 w-4" /></button>}
                <button onClick={() => remove(m.id)} className="rounded p-2 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <input value={replyText[m.id] || ''} onChange={(e) => setReplyText({ ...replyText, [m.id]: e.target.value })} placeholder="উত্তর লিখুন..." className="input-bangla" />
              <button onClick={() => sendReply(m.id)} className="flex items-center gap-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"><Send className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
        {messages.length === 0 && <div className="rounded-2xl border border-border bg-card p-12 text-center"><Mail className="mx-auto mb-4 h-12 w-12 text-muted-foreground/40" /><p className="text-muted-foreground">কোন মেসেজ নেই</p></div>}
      </div>
    </div>
  );
}
