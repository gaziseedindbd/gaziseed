-- Keep selected combo-tier totals and persisted item rows in agreement.
-- The tier offer is the total for the chosen quantity; payment and inventory
-- logic are intentionally unchanged.
DO $migration$
DECLARE
  v_definition text;
  v_old_json text;
  v_new_json text;
  v_old_values text;
  v_new_values text;
  v_count integer;
BEGIN
  SELECT pg_get_functiondef(
    'public.create_combo_order(uuid,integer,text,text,text,text,text)'::regprocedure
  ) INTO v_definition;

  v_old_json := $old$jsonb_build_array(jsonb_build_object('combo_id',p_combo_id,'quantity',v_qty,'unit_price',v_combo_price))$old$;
  v_new_json := $new$jsonb_build_array(jsonb_build_object('combo_id',p_combo_id,'quantity',v_qty,'unit_price',round(v_combo_price/v_qty,2),'total_price',v_combo_price))$new$;
  v_count := (length(v_definition) - length(replace(v_definition, v_old_json, ''))) / length(v_old_json);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Unexpected create_combo_order item payload; expected two occurrences, found %', v_count;
  END IF;
  v_definition := replace(v_definition, v_old_json, v_new_json);

  v_old_values := $old$values(v_order_id,v_title,v_qty,v_combo_price,v_combo_price*v_qty);$old$;
  v_new_values := $new$values(v_order_id,v_title,v_qty,round(v_combo_price/v_qty,2),v_combo_price);$new$;
  v_count := (length(v_definition) - length(replace(v_definition, v_old_values, ''))) / length(v_old_values);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Unexpected create_combo_order line total; expected one occurrence, found %', v_count;
  END IF;
  v_definition := replace(v_definition, v_old_values, v_new_values);
  EXECUTE v_definition;

  SELECT pg_get_functiondef(
    'public.complete_cashfree_campaign_order_atomic(uuid)'::regprocedure
  ) INTO v_definition;

  v_old_json := $old$jsonb_build_array(jsonb_build_object('combo_id',NULLIF(v_context->>'combo_id','')::uuid,'quantity',v_quantity,'unit_price',v_offer_price))$old$;
  v_new_json := $new$jsonb_build_array(jsonb_build_object('combo_id',NULLIF(v_context->>'combo_id','')::uuid,'quantity',v_quantity,'unit_price',round(v_offer_price/v_quantity,2),'total_price',v_offer_price))$new$;
  v_count := (length(v_definition) - length(replace(v_definition, v_old_json, ''))) / length(v_old_json);
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Unexpected India campaign combo item payload; expected two occurrences, found %', v_count;
  END IF;
  v_definition := replace(v_definition, v_old_json, v_new_json);

  v_old_values := $old$VALUES(v_order_id,COALESCE(v_combo_title,'Combo pack'),v_quantity,v_offer_price,v_offer_price*v_quantity);$old$;
  v_new_values := $new$VALUES(v_order_id,COALESCE(v_combo_title,'Combo pack'),v_quantity,round(v_offer_price/v_quantity,2),v_offer_price);$new$;
  v_count := (length(v_definition) - length(replace(v_definition, v_old_values, ''))) / length(v_old_values);
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'Unexpected India campaign combo line total; expected one occurrence, found %', v_count;
  END IF;
  v_definition := replace(v_definition, v_old_values, v_new_values);
  EXECUTE v_definition;
END;
$migration$;
