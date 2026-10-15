-- India-only tracking foundation; no order/payment state transitions.
create table if not exists public.india_shipping_shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id),
  country_code text not null default 'IN' check (country_code = 'IN'),
  external_order_id text,
  external_shipment_id text,
  awb text,
  courier_company_id integer,
  pickup_approved_at timestamptz,
  pickup_approved_by uuid,
  tracking_status text,
  tracking_occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id),
  unique (external_order_id),
  unique (external_shipment_id),
  unique (awb)
);
create index if not exists india_shipping_shipments_external_shipment_idx
  on public.india_shipping_shipments (external_shipment_id);
alter table public.india_shipping_shipments enable row level security;
revoke all on public.india_shipping_shipments from anon, authenticated;

create table if not exists public.india_shipping_webhook_events (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.india_shipping_shipments(id),
  event_key text not null,
  event_status text,
  event_occurred_at timestamptz,
  received_at timestamptz not null default now(),
  unique (shipment_id, event_key)
);
alter table public.india_shipping_webhook_events enable row level security;
revoke all on public.india_shipping_webhook_events from anon, authenticated;

-- Never let a Bangladesh order be linked to an India shipment, even via service role.
create or replace function public.guard_india_shipping_shipment()
returns trigger language plpgsql set search_path = public as $$
begin
  if not exists (select 1 from public.orders where id = new.order_id and country_code = 'IN') then
    raise exception 'Only India orders may be linked to India shipping';
  end if;
  return new;
end $$;
drop trigger if exists guard_india_shipping_shipment_trigger on public.india_shipping_shipments;
create trigger guard_india_shipping_shipment_trigger
before insert or update of order_id on public.india_shipping_shipments
for each row execute function public.guard_india_shipping_shipment();
