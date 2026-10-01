'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  Activity,
  Clock3,
  Gauge,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  TimerReset,
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

type SupportQueueItem = {
  id: string;
  conversation_id: string;
  reason: string;
  status: string;
  queue_state: 'pending' | 'open' | 'closed';
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
  customer_profile: {
    name?: string | null;
    phone?: string | null;
    address?: string | null;
    total_orders?: number | null;
    total_spent?: number | null;
    last_order_number?: string | null;
  } | null;
  conversation: {
    external_user_id: string | null;
    status: string;
    last_message_at: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
  context: Array<{
    id: string;
    role: string;
    content: string | null;
    created_at: string;
    action_status: string | null;
  }>;
};

type DashboardData = {
  messenger: { enabled: boolean; meta_configured: boolean; webhook_signature_required: boolean };
  settings: { is_enabled: boolean; provider: string | null; model: string | null; base_url: string | null; temperature: number | null; max_tokens: number | null; feature_flags: Record<string, boolean>; updated_at: string | null } | null;
  providers: Provider[];
  stats: { conversations: number; open_handoffs: number; recent_messages: number; product_orders: number; combo_orders: number; offer_orders: number };
  conversations: Array<{ id: string; channel: string; external_user_id: string | null; status: string; last_message_at: string | null; updated_at: string | null }>;
  handoffs: Array<{ id: string; conversation_id: string; reason: string; status: string; created_at: string; resolved_at: string | null }>;
  messages: Array<{ id: string; conversation_id: string; role: string; provider: string | null; model: string | null; tool_name: string | null; action_status: string | null; requires_confirmation: boolean; created_at: string }>;
  monitoring: {
    window_hours: number;
    responses: number;
    successful_responses: number;
    fallback_responses: number;
    fallback_rate_percent: number;
    provider_failure_responses: number;
    total_tokens: number;
    average_success_latency_ms: number | null;
    provider_stats: Array<{
      provider: string;
      attempts: number;
      successes: number;
      failures: number;
      fallback_hits: number;
      average_latency_ms: number | null;
    }>;
  };
};

async function getAdminAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: 'Bearer ' + session.access_token }
    : {};
}

function formatDate(value: string | null) {
  if (!value) return '—';
  try { return new Date(value).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return value; }
}

export default function AIMessengerAdminPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [supportQueue, setSupportQueue] = useState<SupportQueueItem[]>([]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const headers = await getAdminAuthHeaders();
      const [assistantRes, supportRes] = await Promise.all([
        fetch('/api/admin/ai-assistant', { cache: 'no-store', headers }),
        fetch('/api/admin/ai-assistant/human-support', { cache: 'no-store', headers }),
      ]);

      const assistantJson = await assistantRes.json();
      const supportJson = await supportRes.json();

      if (!assistantRes.ok || !assistantJson.success) {
        throw new Error(assistantJson.message || 'AI Messenger data load failed');
      }

      if (!supportRes.ok || !supportJson.success) {
        throw new Error(supportJson.message || 'Human support queue load failed');
      }

      setData(assistantJson);
      setSupportQueue(supportJson.support_queue || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI Messenger data load failed');
    } finally {
      setLoading(false);
    }
  }

  async function updateSupportHandoff(
    handoffId: string,
    action: 'claim' | 'close' | 'reopen',
  ) {
    try {
      setError('');
      const authHeaders = await getAdminAuthHeaders();
      const res = await fetch('/api/admin/ai-assistant/human-support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ handoff_id: handoffId, action }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'Support handoff update failed');
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Support handoff update failed');
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

      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><Activity className="h-5 w-5 text-primary" /><h2 className="text-lg font-bold">AI Monitoring</h2></div>
            <p className="mt-1 text-sm text-muted-foreground">গত {data.monitoring.window_hours} ঘণ্টার Messenger AI runtime telemetry</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-semibold"><TimerReset className="h-3.5 w-3.5" /> Live data</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-secondary/40 p-5"><p className="text-sm text-muted-foreground">AI Responses</p><p className="mt-2 text-2xl font-bold">{data.monitoring.responses}</p><p className="mt-1 text-xs text-muted-foreground">{data.monitoring.successful_responses} successful</p></div>
          <div className="rounded-2xl bg-secondary/40 p-5"><p className="text-sm text-muted-foreground">Fallback Rate</p><p className="mt-2 text-2xl font-bold">{data.monitoring.fallback_rate_percent}%</p><p className="mt-1 text-xs text-muted-foreground">{data.monitoring.fallback_responses} fallback responses</p></div>
          <div className="rounded-2xl bg-secondary/40 p-5"><p className="text-sm text-muted-foreground">Avg Latency</p><p className="mt-2 text-2xl font-bold">{data.monitoring.average_success_latency_ms == null ? '—' : data.monitoring.average_success_latency_ms + ' ms'}</p><p className="mt-1 text-xs text-muted-foreground"><Gauge className="mr-1 inline h-3.5 w-3.5" /> successful provider response</p></div>
          <div className="rounded-2xl bg-secondary/40 p-5"><p className="text-sm text-muted-foreground">Provider Failures</p><p className="mt-2 text-2xl font-bold">{data.monitoring.provider_failure_responses}</p><p className="mt-1 text-xs text-muted-foreground">turned into human handoff</p></div>
          <div className="rounded-2xl bg-secondary/40 p-5"><p className="text-sm text-muted-foreground">Reported Tokens</p><p className="mt-2 text-2xl font-bold">{data.monitoring.total_tokens.toLocaleString()}</p><p className="mt-1 text-xs text-muted-foreground">provider-reported usage</p></div>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-3 py-3">Provider</th>
                <th className="px-3 py-3">Attempts</th>
                <th className="px-3 py-3">Success</th>
                <th className="px-3 py-3">Failures</th>
                <th className="px-3 py-3">Fallback Hits</th>
                <th className="px-3 py-3">Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              {data.monitoring.provider_stats.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-5 text-center text-sm text-muted-foreground">No provider telemetry recorded in this window.</td></tr>
              ) : (
                data.monitoring.provider_stats.map((provider) => (
                  <tr key={provider.provider} className="border-b border-border/70">
                    <td className="px-3 py-3 font-semibold">{provider.provider}</td>
                    <td className="px-3 py-3">{provider.attempts}</td>
                    <td className="px-3 py-3">{provider.successes}</td>
                    <td className="px-3 py-3">{provider.failures}</td>
                    <td className="px-3 py-3">{provider.fallback_hits}</td>
                    <td className="px-3 py-3">{provider.average_latency_ms == null ? '—' : provider.average_latency_ms + ' ms'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-5 flex items-center gap-2"><MessageCircle className="h-5 w-5 text-primary" /><div><h2 className="text-lg font-bold">Recent Conversations</h2><p className="text-sm text-muted-foreground">সবচেয়ে সাম্প্রতিক Messenger sessions</p></div></div><div className="space-y-3">{data.conversations.length === 0 ? <p className="text-sm text-muted-foreground">No conversations yet.</p> : data.conversations.map((conversation) => <div key={conversation.id} className="rounded-xl border border-border p-4"><div className="flex items-center justify-between gap-3"><span className="font-semibold">{conversation.status}</span><span className="text-xs text-muted-foreground"><Clock3 className="mr-1 inline h-3 w-3" />{formatDate(conversation.updated_at)}</span></div><p className="mt-2 text-xs text-muted-foreground">User: {conversation.external_user_id || '—'}</p></div>)}</div></section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <UserRound className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-lg font-bold">Bangladesh Human Support Queue</h2>
                <p className="text-sm text-muted-foreground">Customer request → pending → agent takeover → closed</p>
              </div>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold">
              {supportQueue.filter((item) => item.queue_state !== 'closed').length} active
            </span>
          </div>

          <div className="space-y-4">
            {supportQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Bangladesh human-support requests yet.</p>
            ) : (
              supportQueue.map((handoff) => (
                <div key={handoff.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold uppercase">
                        {handoff.queue_state}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDate(handoff.created_at)}</span>
                    </div>
                    <div className="flex gap-2">
                      {handoff.queue_state === 'pending' ? (
                        <button
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                          onClick={() => updateSupportHandoff(handoff.id, 'claim')}
                        >
                          Take Support
                        </button>
                      ) : null}
                      {handoff.queue_state !== 'closed' ? (
                        <button
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                          onClick={() => updateSupportHandoff(handoff.id, 'close')}
                        >
                          Close
                        </button>
                      ) : (
                        <button
                          className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary"
                          onClick={() => updateSupportHandoff(handoff.id, 'reopen')}
                        >
                          Reopen
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-sm font-medium">{handoff.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Messenger user: {handoff.conversation?.external_user_id || '—'}
                  </p>

                  {handoff.customer_profile ? (
                    <div className="mt-3 rounded-xl bg-secondary/40 p-3 text-xs">
                      <div className="grid gap-1 sm:grid-cols-2">
                        <span>নাম: {handoff.customer_profile.name || '—'}</span>
                        <span>ফোন: {handoff.customer_profile.phone || '—'}</span>
                        <span>ঠিকানা: {handoff.customer_profile.address || '—'}</span>
                        <span>আগের orders: {handoff.customer_profile.total_orders ?? '—'}</span>
                        <span>শেষ order: {handoff.customer_profile.last_order_number || '—'}</span>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 rounded-xl border border-border/70 bg-background p-3">
                    <p className="mb-2 text-xs font-semibold text-muted-foreground">Previous Conversation Context</p>
                    <div className="max-h-64 space-y-2 overflow-y-auto">
                      {handoff.context.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No conversation messages found.</p>
                      ) : (
                        handoff.context.map((message) => (
                          <div key={message.id} className="rounded-lg border border-border/60 p-2">
                            <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                              <span className="font-semibold">{message.role}</span>
                              <span>{formatDate(message.created_at)}</span>
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-xs">{message.content || '—'}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {handoff.queue_state === 'open' ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Human agent takeover active — Messenger AI remains blocked until this handoff is closed.
                    </p>
                  ) : handoff.queue_state === 'pending' ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Pending queue — customer has requested a human and AI replies are blocked.
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Closed — conversation has been returned to automated AI routing.
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-card p-6"><div className="mb-4"><h2 className="text-lg font-bold">Recent AI Activity</h2><p className="mt-1 text-sm text-muted-foreground">Provider/tool activity; secret values are excluded</p></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-border text-xs text-muted-foreground"><th className="px-3 py-3">Time</th><th className="px-3 py-3">Role</th><th className="px-3 py-3">Provider</th><th className="px-3 py-3">Tool</th><th className="px-3 py-3">Confirmation</th></tr></thead><tbody>{data.messages.map((message) => <tr key={message.id} className="border-b border-border/70"><td className="px-3 py-3 whitespace-nowrap">{formatDate(message.created_at)}</td><td className="px-3 py-3">{message.role}</td><td className="px-3 py-3">{message.provider || '—'}</td><td className="px-3 py-3">{message.tool_name || '—'}</td><td className="px-3 py-3">{message.requires_confirmation ? 'Required' : '—'}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
