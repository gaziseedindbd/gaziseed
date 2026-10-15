-- Persist provider IDs without ever allowing a second external booking attempt.
create or replace function public.record_india_shipping_external_order(
 p_shipment_id uuid, p_external_order_id text, p_external_shipment_id text,
 p_courier_company_id integer
) returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 if nullif(trim(p_external_order_id),'') is null or nullif(trim(p_external_shipment_id),'') is null or
    p_courier_company_id is null or p_courier_company_id <= 0 then
   raise exception 'Invalid external shipment identifiers';
 end if;
 update public.india_shipping_shipments s
 set external_order_id=p_external_order_id, external_shipment_id=p_external_shipment_id,
     courier_company_id=p_courier_company_id, creation_state='external_created',updated_at=now()
 from public.orders o
 where s.id=p_shipment_id and o.id=s.order_id and o.country_code='IN'
   and s.creation_state='submitting' and s.external_order_id is null and s.external_shipment_id is null;
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.record_india_shipping_external_order(uuid,text,text,integer) from public,anon,authenticated;
grant execute on function public.record_india_shipping_external_order(uuid,text,text,integer) to service_role;

create or replace function public.record_india_shipping_awb(
 p_shipment_id uuid,p_external_shipment_id text,p_awb text
) returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 if nullif(trim(p_awb),'') is null then raise exception 'Invalid AWB'; end if;
 update public.india_shipping_shipments s
 set awb=p_awb,creation_state='awb_assigned',updated_at=now()
 from public.orders o
 where s.id=p_shipment_id and o.id=s.order_id and o.country_code='IN'
   and s.creation_state='external_created' and s.external_shipment_id=p_external_shipment_id and s.awb is null;
 get diagnostics changed=row_count;
 return changed=1;
end $$;
revoke all on function public.record_india_shipping_awb(uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_india_shipping_awb(uuid,text,text) to service_role;
