-- Draft only. Service-role workflow must verify India admin JWT before invoking approval.
alter table public.india_shipping_shipments
  add column if not exists pickup_request_state text not null default 'not_requested'
    check (pickup_request_state in ('not_requested','requesting','requested','failed')),
  add column if not exists pickup_requested_at timestamptz,
  add column if not exists pickup_request_attempted_at timestamptz;

-- This function is an atomic, idempotent claim used *after* authenticated approval.
-- Only a trusted backend with service role may call it; it never calls Shiprocket.
create or replace function public.claim_india_shipping_pickup(p_shipment_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare changed_count integer;
begin
  update public.india_shipping_shipments s
     set pickup_request_state = 'requesting',
         pickup_request_attempted_at = now(),
         updated_at = now()
    from public.orders o
   where s.id = p_shipment_id
     and s.order_id = o.id
     and s.country_code = 'IN'
     and o.country_code = 'IN'
     and o.status = 'packed'
     and s.awb is not null
     and s.external_shipment_id is not null
     and s.pickup_approved_at is not null
     and s.pickup_approved_by is not null
     and s.pickup_request_state = 'not_requested';
  get diagnostics changed_count = row_count;
  return changed_count = 1;
end $$;
revoke all on function public.claim_india_shipping_pickup(uuid) from public, anon, authenticated;
grant execute on function public.claim_india_shipping_pickup(uuid) to service_role;
