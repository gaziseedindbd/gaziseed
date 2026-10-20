-- Align combo server fee with included product-level free delivery.
do $mig$
declare f text; updated text;
begin
 select pg_get_functiondef('public.create_combo_order(uuid,integer,text,text,text,text,text)'::regprocedure) into f;
 if f is null or position('v_delivery_charge:=public.calculate_delivery_charge(v_combo_price,v_free_delivery);' in f)=0
 then raise exception 'Combo checkout definition changed; refusing automatic patch'; end if;
 updated := replace(f,
 'v_delivery_charge:=public.calculate_delivery_charge(v_combo_price,v_free_delivery);',
 'v_free_delivery := v_free_delivery or exists (' ||
 'select 1 from public.combo_packs cp cross join lateral jsonb_array_elements_text(' ||
 'case when jsonb_typeof(cp.product_ids)=''array'' then cp.product_ids else ''[]''::jsonb end) pid ' ||
 'join public.products product on product.id::text=pid.value ' ||
 'where cp.id=p_combo_id and product.is_active=true and coalesce(product.free_delivery,false)); ' ||
 'v_delivery_charge:=public.calculate_delivery_charge(v_combo_price,v_free_delivery);');
 if updated=f then raise exception 'Combo policy patch failed'; end if;
 execute updated;
end $mig$;
