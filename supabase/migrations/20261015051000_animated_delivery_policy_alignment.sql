-- Guarded change: Animated landing COD orders must use shared branch delivery policy
-- while honoring both package- and product-level free delivery.
do $mig$
declare f text; updated text;
begin
 select pg_get_functiondef('public.create_animated_landing_order(uuid,uuid,text,text,text,uuid,text,text,text,text,text,text,text,text,text)'::regprocedure) into f;
 if f is null or position('v_delivery_charge := coalesce(v_custom_delivery_charge, public.calculate_delivery_charge(v_offer_price, v_free_delivery));' in f)=0
   or position('select stock, coalesce(nullif(name_bn' in f)=0 then
   raise exception 'Animated landing order function changed; review manually';
 end if;
 updated := replace(f,
   'select stock, coalesce(nullif(name_bn',
   'select stock, coalesce(nullif(name_bn');
 -- Product free delivery is additive to package free-delivery; no new order columns.
 updated := replace(updated,
   '  if v_stock is null or v_stock < v_quantity then raise exception ''Insufficient stock for selected package''; end if;',
   '  select coalesce(free_delivery,false) into strict v_free_delivery from public.products where id=v_product_id and is_active=true;' ||
   E'\n  v_free_delivery := v_free_delivery or coalesce((select free_delivery from public.animated_landing_packages where id=p_package_id),false);' ||
   E'\n  if v_stock is null or v_stock < v_quantity then raise exception ''Insufficient stock for selected package''; end if;');
 updated := replace(updated,
   'v_delivery_charge := coalesce(v_custom_delivery_charge, public.calculate_delivery_charge(v_offer_price, v_free_delivery));',
   'v_delivery_charge := public.calculate_delivery_charge(v_offer_price, v_free_delivery);');
 if updated=f or position('v_delivery_charge := public.calculate_delivery_charge(v_offer_price, v_free_delivery);' in updated)=0
 then raise exception 'Animated landing delivery patch failed'; end if;
 execute updated;
end $mig$;
