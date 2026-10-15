-- Campaign Cashfree fee calculation must match /admin/delivery without changing payment orchestration.
-- Fail closed if existing function has drifted.
do $mig$
declare f text; patched text;
begin
 select pg_get_functiondef('public.quote_india_campaign_order(text,jsonb)'::regprocedure) into f;
 if f is null
    or position('v_delivery:=CASE WHEN v_free_delivery THEN 0 ELSE COALESCE(v_custom_delivery,public.calculate_delivery_charge(v_offer_price,false)) END;' in f)=0
    or position('v_delivery:=public.calculate_delivery_charge(v_offer_price,v_free_delivery);' in f)=0
 then raise exception 'Cashfree campaign function changed; manual review required'; end if;
 patched := replace(f,
  'v_delivery:=CASE WHEN v_free_delivery THEN 0 ELSE COALESCE(v_custom_delivery,public.calculate_delivery_charge(v_offer_price,false)) END;',
  'v_free_delivery:=v_free_delivery or exists (select 1 from public.products fp where fp.id=v_product_id and fp.is_active=true and upper(coalesce(fp.country_code,''BD''))=''IN'' and coalesce(fp.free_delivery,false));' ||
  ' v_delivery:=public.calculate_delivery_charge(v_offer_price,v_free_delivery);'
 );
 patched := replace(patched,
  'v_delivery:=public.calculate_delivery_charge(v_offer_price,v_free_delivery);' || E'\n  ELSE',
  'v_free_delivery:=v_free_delivery or exists (' ||
  'select 1 from public.combo_packs cp cross join lateral jsonb_array_elements_text(' ||
  'case when jsonb_typeof(cp.product_ids)=''array'' then cp.product_ids else ''[]''::jsonb end) pid ' ||
  'join public.products fp on fp.id::text=pid.value and fp.is_active=true and coalesce(fp.free_delivery,false) ' ||
  'where cp.id=v_combo_id); ' ||
  'v_delivery:=public.calculate_delivery_charge(v_offer_price,v_free_delivery);' || E'\n  ELSE'
 );
 if patched=f
   or position('v_free_delivery:=v_free_delivery or exists (select 1 from public.products fp' in patched)=0
   or position('where cp.id=v_combo_id' in patched)=0 then
   raise exception 'Cashfree delivery patch incomplete';
 end if;
 execute patched;
end $mig$;
