'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Check, ExternalLink, Mail, MessageCircle, Phone, RefreshCw, X } from 'lucide-react';
import { toast } from '@/components/site/toast-provider';

type ContactMessage = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  is_read: boolean;
  created_at: string | null;
};

type SupportTicket = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  subject: string;
  message: string;
  status: string | null;
  order_id: string | null;
  created_at: string;
};

export default function AdminSupportPage() {
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [{ data: messages }, { data: supportTickets }] = await Promise.all([
      supabase.from('contact_messages').select('*').order('created_at', { ascending: false }),
      supabase.from('support_tickets').select('*').order('created_at', { ascending: false }),
    ]);

    setContactMessages(messages || []);
    setTickets(supportTickets || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const markAsRead = async (message: ContactMessage) => {
    if (message.is_read) return;
    const { error } = await supabase.from('contact_messages').update({ is_read: true }).eq('id', message.id);
    if (error) {
      toast('মেসেজ আপডেট করা যায়নি');
      return;
    }
    setContactMessages((current) => current.map((item) => item.id === message.id ? { ...item, is_read: true } : item));
    setSelectedMessage((current) => current?.id === message.id ? { ...current, is_read: true } : current);
  };

  const updateTicketStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('support_tickets').update({ status }).eq('id', id);
    if (error) {
      toast('স্ট্যাটাস আপডেট করা যায়নি');
      return;
    }
    setTickets((current) => current.map((ticket) => ticket.id === id ? { ...ticket, status } : ticket));
    toast('স্ট্যাটাস আপডেট হয়েছে');
  };

  const unreadCount = contactMessages.filter((message) => !message.is_read).length;

  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-secondary" />;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">সাপোর্ট / অভিযোগ</h1>
          <p className="mt-1 text-sm text-muted-foreground">ওয়েবসাইটের Contact Form-এর মেসেজ এবং সাপোর্ট টিকেট এখান থেকে দেখুন।</p>
        </div>
        <button onClick={loadData} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-secondary">
          <RefreshCw className="h-4 w-4" /> রিফ্রেশ
        </button>
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Contact Form Messages</h2>
            <p className="text-sm text-muted-foreground">নতুন মেসেজ: <span className="font-bold text-primary">{unreadCount}</span></p>
          </div>
        </div>

        {selectedMessage ? (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold">{selectedMessage.name}</h3>
                  {!selectedMessage.is_read && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">নতুন</span>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selectedMessage.created_at ? new Date(selectedMessage.created_at).toLocaleString('bn-BD') : '-'}
                </p>
              </div>
              <button onClick={() => setSelectedMessage(null)} className="rounded-full p-2 hover:bg-secondary" aria-label="বন্ধ করুন">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">মোবাইল</p>
                <p className="mt-1 font-semibold">{selectedMessage.phone}</p>
              </div>
              <div className="rounded-xl bg-secondary/40 p-3">
                <p className="text-xs text-muted-foreground">ইমেইল</p>
                <p className="mt-1 font-semibold">{selectedMessage.email || '-'}</p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-semibold text-muted-foreground">মেসেজ</p>
              <p className="mt-2 whitespace-pre-wrap leading-7">{selectedMessage.message}</p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {!selectedMessage.is_read && (
                <button onClick={() => markAsRead(selectedMessage)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">
                  <Check className="h-4 w-4" /> দেখা হয়েছে
                </button>
              )}
              <a href={`tel:${selectedMessage.phone}`} className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">
                <Phone className="h-4 w-4" /> ফোন করুন
              </a>
              <a href={`https://wa.me/${selectedMessage.phone.replace(/\D/g, '').replace(/^0/, '880')}?text=${encodeURIComponent('SEED BARI-তে যোগাযোগ করার জন্য ধন্যবাদ। আপনার মেসেজের বিষয়ে কথা বলতে চাই।')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
                <MessageCircle className="h-4 w-4" /> WhatsApp
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {contactMessages.map((message) => (
              <button key={message.id} onClick={() => { setSelectedMessage(message); markAsRead(message); }} className="w-full rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">{message.name}</p>
                      {!message.is_read && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">নতুন</span>}
                    </div>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {message.phone}</p>
                    <p className="mt-2 line-clamp-2 text-sm text-foreground">{message.message}</p>
                  </div>
                  <Mail className={`h-5 w-5 shrink-0 ${message.is_read ? 'text-muted-foreground' : 'text-primary'}`} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">{message.created_at ? new Date(message.created_at).toLocaleString('bn-BD') : '-'}</p>
              </button>
            ))}
            {contactMessages.length === 0 && <div className="rounded-2xl border border-dashed border-border p-10 text-center text-muted-foreground">কোনো Contact Message নেই</div>}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-bold">সাপোর্ট টিকেট</h2>
          <p className="text-sm text-muted-foreground">অর্ডার/সাপোর্ট সংক্রান্ত অভিযোগগুলো</p>
        </div>
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{ticket.subject}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{ticket.status || 'open'}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{ticket.customer_name || 'কাস্টমার'} {ticket.customer_phone ? `— ${ticket.customer_phone}` : ''}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{ticket.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{new Date(ticket.created_at).toLocaleString('bn-BD')}</p>
                </div>
                <select value={ticket.status || 'open'} onChange={(e) => updateTicketStatus(ticket.id, e.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="open">ওপেন</option>
                  <option value="in_review">রিভিউতে</option>
                  <option value="resolved">সমাধান</option>
                  <option value="closed">বন্ধ</option>
                </select>
              </div>
            </div>
          ))}
          {tickets.length === 0 && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">কোনো সাপোর্ট টিকেট নেই</div>}
        </div>
      </section>
    </div>
  );
}
