create table if not exists public.meta_capi_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  event_id text not null,
  order_id uuid references public.orders(id) on delete set null,
  country_code text not null check (country_code = any (array['BD'::text, 'IN'::text])),
  status text not null default 'pending' check (status = any (array['pending'::text, 'processing'::text, 'sent'::text, 'failed'::text])),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_name, event_id)
);

create index if not exists meta_capi_events_order_id_idx
  on public.meta_capi_events(order_id);

create index if not exists meta_capi_events_status_updated_at_idx
  on public.meta_capi_events(status, updated_at);

alter table public.meta_capi_events enable row level security;

revoke all on public.meta_capi_events from anon, authenticated;
grant all on public.meta_capi_events to service_role;

comment on table public.meta_capi_events is
  'Internal Meta Conversions API delivery/idempotency log. Service-role access only.';
