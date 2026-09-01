'use client';

import { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  UserRound,
  Zap,
} from 'lucide-react';

type Provider = {
  key: string;
  label: string;
  configured: boolean;
  model: string;
  priority: number;
};

type DashboardData = {
  messenger: { enabled: boolean; meta_configured: boolean; webhook_signature_required: boolean };
  settings: { is_enabled: boolean; provider: string | null; model: string | null; base_url: string | null; temperature: number | null; max_tokens: number | null; feature_flags: Record<string, boolean>; updated_at: string | null } | null;
  providers: Provider[];
  stats: { conversations: number; open_handoffs: number; recent_messages: number; product_orders: number; combo_orders: number; offer_orders: number };
  conversations: Array<{ id: string; channel: string; external_user_id: string | null; status: string; last_message_at: string | null; updated_at: string | null }>;
  handoffs: Array<{ id: string; conversation_id: string; reason: string; status: string; created_at: string; resolved_at: string | null }>;
  messages: Array<{ id: string; conversation_id: string; role: string; provider: string | null; model: string | null; tool_name: string | null; action_status: string | null; requires_confirmation: boolean; created_at: string }>;
};

function formatDate(value: string | null) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return value; }
}

export default function AIMessengerAdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/ai-assistant', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'AI Messenger data load failed');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI Messenger data load failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  if (loading && !data) return <div className="flex min-h-[420px] items-center justify-center"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>;
  if (error && !data) return <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">{error}</div>;
  if (!data) return null;

  const statCards: Array<{ label: string; value: number; icon: typeof MessageCircle }> = [
    { label: 'Conversations', value: data.stats.conversations, icon: MessageCircle },
    { label: 'Open Handoffs', value: data.stats.open_handoffs, icon: UserRound },
    { label: 'Product Orders', value: data.stats.product_orders, icon: Zap },
    { label: 'Offer/Combo Orders', value: data.stats.combo_orders + data.stats.offer_orders, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bot className="h-6 w-6" /></div>
          <div><h1 className="text-2xl font-bold">AI Messenger</h1><p className="mt-1 text-sm text-muted-foreground">Facebook Messenger AI-এর আলাদা monitoring ও control center</p></div>
        </div>
        <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{card.label}</span><Icon className="h-5 w-5 text-primary" /></div><div className="mt-3 text-3xl font-bold">{card.value}</div></div>; })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Live Status</h2><p className="mt-1 text-sm text-muted-foreground">Production connection status</p></div><ShieldCheck className="h-5 w-5 text-primary" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">AI Messenger</p><p className={`mt-1 font-semibold ${data.messenger.enabled ? 'text-green-600' : 'text-amber-600'}`}>{data.messenger.enabled ? 'Enabled' : 'Disabled'}</p></div>
            <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Meta Credentials</p><p className={`mt-1 font-semibold ${data.messenger.meta_configured ? 'text-green-600' : 'text-amber-600'}`}>{data.messenger.meta_configured ? 'Configured' : 'Not configured'}</p></div>
            <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">Signature Verification</p><p className="mt-1 font-semibold text-green-600">{data.messenger.webhook_signature_required ? 'Required' : 'Not required'}</p></div>
            <div className="rounded-xl border border-border p-4"><p className="text-xs text-muted-foreground">AI System</p><p className={`mt-1 font-semibold ${data.settings?.is_enabled ? 'text-green-600' : 'text-amber-600'}`}>{data.settings?.is_enabled ? 'Enabled' : 'Disabled'}</p></div>
          </div>
          <div className="mt-4 rounded-xl bg-secondary/40 p-4 text-xs leading-6 text-muted-foreground">API keys and Meta secrets are intentionally never shown in this dashboard. They remain server-side only.</div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold">Provider Failover</h2><p className="mt-1 text-sm text-muted-foreground">Priority order and configuration status</p></div><Zap className="h-5 w-5 text-primary" /></div>
          <div className="space-y-3">
            {data.providers.map((provider) => <div key={provider.key} className="flex items-center gap-3 rounded-xl border border-border p-3"><div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold">{provider.priority}</div><div className="min-w-0 flex-1"><div className="font-semibold">{provider.label}</div><div className="truncate text-xs text-muted-foreground">{provider.model}</div></div>{provider.configured ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600"><CheckCircle2 className="h-4 w-4" /> Ready</span> : <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><CircleAlert className="h-4 w-4" /> Missing key</span>}</div>)}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5"><h2 className="text-lg font-bold">Order Channels</h2><p className="mt-1 text-sm text-muted-foreground">Messenger থেকে কোন ধরনের order হয়েছে তার হিসাব</p></div>
        <div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl bg-secondary/40 p-5"><p className="text-sm text-muted-foreground">Normal Product</p><p className="mt-2 text-2xl font-bold">{data.stats.product_orders}</p></div><div className="rounded-2xl bg-secondary/40 p-5"><p className="text-sm text-muted-foreground">Combo</p><p className="mt-2 text-2xl font-bold">{data.stats.combo_orders}</p></div><div className="rounded-2xl bg-secondary/40 p-5"><p className="text-sm text-muted-foreground">Ads / Landing Offer</p><p className="mt-2 text-2xl font-bold">{data.stats.offer_orders}</p></div></div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-5 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /><div><h2 className="text-lg font-bold">Recent Conversations</h2><p className="text-sm text-muted-foreground">সবচেয়ে সাম্প্রতিক Messenger sessions</p></div></div><div className="space-y-3">{data.conversations.length === 0 ? <p className="text-sm text-muted-foreground">No conversations yet.</p> : data.conversations.map((conversation) => <div key={conversation.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><span className="font-semibold">{conversation.status}</span><span className="text-xs text-muted-foreground"><Clock3 className="mr-1 inline h-3 w-3" />{formatDate(conversation.updated_at)}</span></div><p className="mt-2 text-xs text-muted-foreground">User: {conversation.external_user_id || '—'}</p></div>)}</div></section>

        <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-5 flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /><div><h2 className="text-lg font-bold">Human Handoffs</h2><p className="text-sm text-muted-foreground">যে conversation-গুলোতে মানুষ লাগবে</p></div></div><div className="space-y-3">{data.handoffs.length === 0 ? <p className="text-sm text-muted-foreground">No handoffs yet.</p> : data.handoffs.map((handoff) => <div key={handoff.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><span className="font-semibold">{handoff.status}</span><span className="text-xs text-muted-foreground">{formatDate(handoff.created_at)}</span></div><p className="mt-2 text-sm">{handoff.reason}</p></div>)}</div></section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-4"><h2 className="text-lg font-bold">Recent AI Activity</h2><p className="mt-1 text-sm text-muted-foreground">Provider/tool activity; secret values are excluded</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-3 py-3">Time</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Provider</th><th className="px-3 py-3">Tool</th><th className="px-3 py-3">Confirmation</th></tr></thead><tbody>{data.messages.map((message) => <tr key={message.id} className="border-b border-border/70"><td className="px-3 py-3 whitespace-nowrap">{formatDate(message.created_at)}</td><td className="px-3 py-3">{message.role}</td><td className="px-3 py-3">{message.provider || '—'}</td><td className="px-3 py-3">{message.tool_name || '—'}</td><td className="px-3 py-3">{message.requires_confirmation ? 'Required' : '—'}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
