-- Reserve a single India shipment before any external create-order call.
-- Unknown external outcomes must be reconciled, never automatically retried.
alter table public.india_shipping_shipments
 add column if not exists creation_state text not null default 'reserved'
   check (creation_state in ('reserved','submitting','external_created','awb_assigned','reconcile_required')),
 add column if not exists creation_attempted_at timestamptz,
 add column if not exists create_request_key text,
 add constraint india_shipping_create_request_key_unique unique (create_request_key);

create or replace function public.reserve_india_shipping_order(
  p_order_id uuid, p_request_key text
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare result_id uuid;
begin
  if p_request_key is null or length(p_request_key) < 16 or length(p_request_key) > 128 then
    raise exception 'Invalid shipping request key';
  end if;
  -- Serialized order-level lock ensures only one reservation under concurrency.
  perform 1 from public.orders where id = p_order_id and country_code = 'IN'
    and status in ('confirmed','processing','packed') for update;
  if not found then raise exception 'India order is not eligible'; end if;
  insert into public.india_shipping_shipments(order_id,country_code,create_request_key)
  values (p_order_id,'IN',p_request_key)
  on conflict (order_id) do nothing returning id into result_id;
  -- Never hand out a preexisting reservation as permission to book again.
  return result_id;
end $$;
revoke all on function public.reserve_india_shipping_order(uuid,text) from public,anon,authenticated;
grant execute on function public.reserve_india_shipping_order(uuid,text) to service_role;

create or replace function public.claim_india_shipping_creation(p_id uuid)
returns boolean language plpgsql security definer set search_path = public
as $$
declare n integer;
begin
  update public.india_shipping_shipments s
  set creation_state = 'submitting', creation_attempted_at=now(), updated_at=now()
  from public.orders o
  where s.id=p_id and s.order_id=o.id and s.country_code='IN' and o.country_code='IN'
    and o.status in ('confirmed','processing','packed')
    and s.creation_state='reserved'
    and s.external_order_id is null and s.external_shipment_id is null;
  get diagnostics n=row_count;
  return n=1;
end $$;
revoke all on function public.claim_india_shipping_creation(uuid) from public,anon,authenticated;
grant execute on function public.claim_india_shipping_creation(uuid) to service_role;
