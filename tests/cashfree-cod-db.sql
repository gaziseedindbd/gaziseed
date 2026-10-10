BEGIN;
CREATE TEMP TABLE orders (LIKE public.orders INCLUDING DEFAULTS);
CREATE TEMP TABLE cashfree_payment_intents (LIKE public.cashfree_payment_intents INCLUDING DEFAULTS);
CREATE TEMP TABLE referral_wallet_transactions (LIKE public.referral_wallet_transactions INCLUDING DEFAULTS);
CREATE TEMP TABLE admin_audit_log (LIKE public.admin_audit_log INCLUDING DEFAULTS);
DO $$DECLARE c record; BEGIN FOR c IN SELECT table_name,column_name FROM information_schema.columns WHERE table_schema LIKE 'pg_temp_%' AND table_name IN ('orders','admin_audit_log') AND is_nullable='NO' LOOP EXECUTE format('ALTER TABLE pg_temp.%I ALTER COLUMN %I DROP NOT NULL',c.table_name,c.column_name); END LOOP; END $$;
CREATE FUNCTION pg_temp.is_admin() RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.cod_admin',true),'true')='true';$$;
CREATE FUNCTION pg_temp.can_access_country(text) RETURNS boolean LANGUAGE sql AS $$SELECT coalesce(current_setting('test.cod_branch',true),'true')='true';$$;
CREATE FUNCTION pg_temp.create_order_with_referral_wallet(text,text,text,jsonb,text,uuid,text,text,uuid,boolean) RETURNS jsonb LANGUAGE plpgsql AS $mock$
DECLARE oid uuid:=gen_random_uuid(); BEGIN
 INSERT INTO pg_temp.orders(id,country_code,status,payment_method,payment_status,final_amount,order_number)
 VALUES(oid,'IN','pending','cod','unpaid',500,'TEST-COD');
 RETURN jsonb_build_object('success',true,'order_id',oid,'order_number','TEST-COD');
END $mock$;
CREATE OR REPLACE FUNCTION pg_temp.complete_cashfree_cod_order_atomic(p_payment_intent_id uuid, p_customer_name text, p_customer_phone text, p_delivery_address text, p_items jsonb, p_coupon_code text DEFAULT NULL::text, p_special_instructions text DEFAULT ''::text, p_user_id uuid DEFAULT NULL::uuid, p_use_referral_wallet boolean DEFAULT false, p_advance_amount numeric DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_intent pg_temp.cashfree_payment_intents%ROWTYPE;
  v_result jsonb;
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric:=0;
  v_discount numeric:=0;
  v_delivery numeric:=0;
  v_wallet numeric:=0;
  v_total numeric:=0;
  v_due numeric:=0;
  v_order_source text := 'website';
BEGIN
  SELECT * INTO v_intent
  FROM pg_temp.cashfree_payment_intents
  WHERE id=p_payment_intent_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success',false,'error','Payment intent not found');
  END IF;

  IF v_intent.completed_order_id IS NOT NULL THEN
    RETURN jsonb_build_object('success',true,'already_completed',true,'payment_intent_id',v_intent.id,'order_id',v_intent.completed_order_id);
  END IF;

  IF v_intent.status<>'processing' THEN
    RETURN jsonb_build_object('success',false,'error','Payment intent is not ready for atomic completion','status',v_intent.status);
  END IF;

  IF upper(coalesce(v_intent.country_code,''))<>'IN' THEN
    RETURN jsonb_build_object('success',false,'error','COD completion is only available for India');
  END IF;

  IF coalesce(v_intent.metadata->>'payment_method','')<>'cod' THEN
    RETURN jsonb_build_object('success',false,'error','Payment intent is not a COD intent');
  END IF;

  IF p_user_id IS DISTINCT FROM v_intent.user_id AND (p_user_id IS NOT NULL OR v_intent.user_id IS NOT NULL) THEN
    RETURN jsonb_build_object('success',false,'error','Payment intent user mismatch');
  END IF;

  v_order_source := CASE
    WHEN v_intent.metadata->>'order_source' = 'facebook_messenger_ai' THEN 'facebook_messenger_ai'
    ELSE 'website'
  END CASE;

  v_subtotal:=coalesce((v_intent.metadata->>'quote_subtotal')::numeric,0);
  v_discount:=coalesce((v_intent.metadata->>'quote_discount')::numeric,0);
  v_delivery:=coalesce((v_intent.metadata->>'quote_delivery')::numeric,0);
  v_wallet:=coalesce(v_intent.wallet_credit_used,0);
  v_total:=coalesce((v_intent.metadata->>'quote_final')::numeric,v_intent.amount,0);
  v_due:=greatest(0,v_total-p_advance_amount);

  IF v_total IS NULL OR p_advance_amount IS NULL OR v_intent.metadata->>'quote_final' IS NULL
     OR v_intent.currency IS DISTINCT FROM 'INR'
     OR v_total::text IN ('NaN','Infinity','-Infinity')
     OR p_advance_amount::text IN ('NaN','Infinity','-Infinity')
     OR p_advance_amount IS DISTINCT FROM v_intent.amount
     OR v_total<=0 OR p_advance_amount<=0 OR p_advance_amount>v_total THEN
    RETURN jsonb_build_object('success',false,'error','Invalid COD advance amount');
  END IF;

  IF p_user_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub',p_user_id::text,true);
  END IF;

  PERFORM set_config('request.headers',jsonb_build_object('x-gazi-country','IN')::text,true);

  v_result:=pg_temp.create_order_with_referral_wallet(
    p_customer_name,
    p_customer_phone,
    p_delivery_address,
    p_items,
    p_coupon_code,
    NULL,
    v_order_source,
    p_special_instructions,
    p_user_id,
    p_use_referral_wallet
  );

  IF NOT coalesce((v_result->>'success')::boolean,false) THEN
    RAISE EXCEPTION '%',coalesce(v_result->>'error','Order creation failed');
  END IF;

  v_order_id:=(v_result->>'order_id')::uuid;
  v_order_number:=v_result->>'order_number';

  UPDATE pg_temp.orders
  SET delivery_charge=v_delivery,
      shipping_fee=v_delivery,
      subtotal=v_subtotal,
      total_amount=v_subtotal,
      discount=v_discount+v_wallet,
      discount_amount=v_discount+v_wallet,
      grand_total=v_total,
      final_amount=v_total,
      payment_status=CASE WHEN v_due=0 THEN 'paid' ELSE 'partially_paid' END,
      payment_method='cod',
      payment_advance_amount=p_advance_amount,
      payment_due_amount=v_due
  WHERE id=v_order_id AND country_code='IN';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Created order could not be aligned to the verified COD quote';
  END IF;

  IF p_use_referral_wallet AND p_user_id IS NOT NULL THEN
    UPDATE pg_temp.referral_wallet_transactions
    SET amount=v_wallet,
        description='Referral wallet used on order '||v_order_number
    WHERE order_id=v_order_id AND user_id=p_user_id AND type='wallet_usage';

    IF v_wallet=0 THEN
      DELETE FROM pg_temp.referral_wallet_transactions
      WHERE order_id=v_order_id AND user_id=p_user_id AND type='wallet_usage';
    END IF;
  END IF;

  UPDATE pg_temp.cashfree_payment_intents
  SET status='completed',
      completed_order_id=v_order_id,
      paid_at=now(),
      updated_at=now()
  WHERE id=v_intent.id
    AND status='processing'
    AND completed_order_id IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent could not be completed';
  END IF;

  RETURN jsonb_build_object(
    'success',true,
    'already_completed',false,
    'payment_intent_id',v_intent.id,
    'order_id',v_order_id,
    'order_number',v_order_number,
    'amount',v_total,
    'advance_amount',p_advance_amount,
    'due_amount',v_due,
    'currency','INR'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success',false,'error',SQLERRM);
END;
$function$;

CREATE OR REPLACE FUNCTION pg_temp.collect_cod_due_atomic(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order pg_temp.orders%ROWTYPE;
  v_collected numeric := 0;
  v_total numeric := 0;
  v_country text;
BEGIN
  IF NOT pg_temp.is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Admin access required');
  END IF;

  SELECT * INTO v_order
  FROM pg_temp.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  v_country := upper(coalesce(v_order.country_code, 'BD'));
  IF v_country <> 'IN' OR NOT pg_temp.can_access_country(v_country) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order is outside the current admin branch');
  END IF;

  IF lower(coalesce(v_order.payment_method, '')) <> 'cod' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only India COD orders can be settled here');
  END IF;

  IF lower(coalesce(v_order.status, '')) <> 'delivered' THEN
    RETURN jsonb_build_object('success', false, 'error', 'COD due can only be collected after delivery');
  END IF;

  IF v_order.payment_due_amount IS NULL OR v_order.payment_advance_amount IS NULL
     OR v_order.final_amount IS NULL OR v_order.final_amount<=0
     OR v_order.payment_due_amount<0 OR v_order.payment_advance_amount<0
     OR v_order.payment_due_amount::text IN ('NaN','Infinity','-Infinity')
     OR v_order.payment_advance_amount::text IN ('NaN','Infinity','-Infinity')
     OR v_order.final_amount::text IN ('NaN','Infinity','-Infinity') THEN
    RETURN jsonb_build_object('success',false,'error','Invalid COD balance. Hold settlement.');
  END IF;
  v_collected := v_order.payment_due_amount;
  IF v_collected <= 0 THEN
    IF lower(coalesce(v_order.payment_status, '')) = 'paid' THEN
      RETURN jsonb_build_object('success', true, 'already_settled', true, 'order_id', v_order.id, 'due_amount', 0);
    END IF;
    RETURN jsonb_build_object('success', false, 'error', 'No outstanding COD due amount');
  END IF;

  v_total := v_order.final_amount;
  IF abs(v_order.payment_advance_amount+v_collected-v_total)>0.01 THEN
    RETURN jsonb_build_object('success',false,'error','COD advance and due do not match total. Hold settlement.');
  END IF;

  UPDATE pg_temp.orders
  SET payment_status = 'paid',
      payment_due_amount = 0
  WHERE id = v_order.id;

  INSERT INTO pg_temp.admin_audit_log(admin_user_id, admin_email, action, details, country_code)
  VALUES (
    auth.uid(),
    coalesce(auth.jwt() ->> 'email', 'unknown'),
    'collect_cod_due',
    jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'amount_collected', v_collected,
      'total_amount', v_total,
      'payment_advance_amount', coalesce(v_order.payment_advance_amount, 0)
    ),
    v_country
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_settled', false,
    'order_id', v_order.id,
    'order_number', v_order.order_number,
    'amount_collected', v_collected,
    'total_amount', v_total,
    'paid_amount', greatest(v_total - 0, 0),
    'due_amount', 0,
    'currency', 'INR'
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;


CREATE OR REPLACE FUNCTION pg_temp.guard_cod_advance_financial_fields()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $guard$
BEGIN
  IF current_user NOT IN ('postgres','service_role','supabase_admin')
    AND upper(coalesce(OLD.country_code,''))='IN'
    AND lower(coalesce(OLD.payment_method,''))='cod'
    AND (coalesce(OLD.payment_advance_amount,0)>0 OR coalesce(NEW.payment_advance_amount,0)>0)
    AND (NEW.payment_advance_amount IS DISTINCT FROM OLD.payment_advance_amount
      OR NEW.payment_due_amount IS DISTINCT FROM OLD.payment_due_amount
      OR NEW.final_amount IS DISTINCT FROM OLD.final_amount
      OR NEW.grand_total IS DISTINCT FROM OLD.grand_total
      OR NEW.total_amount IS DISTINCT FROM OLD.total_amount
      OR NEW.payment_status IS DISTINCT FROM OLD.payment_status
      OR NEW.payment_method IS DISTINCT FROM OLD.payment_method) THEN
    RAISE EXCEPTION 'COD advance balances require a trusted atomic payment operation';
  END IF;
  RETURN NEW;
END;
$guard$;
REVOKE ALL ON FUNCTION pg_temp.guard_cod_advance_financial_fields() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_cod_advance_financial_fields
BEFORE UPDATE OF payment_advance_amount,payment_due_amount,final_amount,grand_total,total_amount,payment_status,payment_method
ON pg_temp.orders FOR EACH ROW EXECUTE FUNCTION pg_temp.guard_cod_advance_financial_fields();

DO $test$
DECLARE fixture uuid; r jsonb; oid uuid; BEGIN
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,metadata,cashfree_order_id)
 VALUES('[]',120,'processing','{"payment_method":"cod","quote_final":500,"quote_subtotal":380,"quote_delivery":120}','COD-TEST') RETURNING id INTO fixture;
 r:=pg_temp.complete_cashfree_cod_order_atomic(fixture,'Tester','9000000000','Fixture address','[]',null,'',null,false,100);
 IF r->>'success'<>'false' THEN RAISE EXCEPTION 'Forged advance accepted'; END IF;
 r:=pg_temp.complete_cashfree_cod_order_atomic(fixture,'Tester','9000000000','Fixture address','[]',null,'',null,false,'NaN');
 IF r->>'success'<>'false' THEN RAISE EXCEPTION 'NaN advance accepted'; END IF;
 r:=pg_temp.complete_cashfree_cod_order_atomic(fixture,'Tester','9000000000','Fixture address','[]',null,'',null,false,null);
 IF r->>'success'<>'false' THEN RAISE EXCEPTION 'Null advance accepted'; END IF;
 r:=pg_temp.complete_cashfree_cod_order_atomic(fixture,'Tester','9000000000','Fixture address','[]',null,'',null,false,120);
 IF r->>'success'<>'true' OR (r->>'due_amount')::numeric<>380 THEN RAISE EXCEPTION 'Valid COD due incorrect: %',r; END IF;
 oid:=(r->>'order_id')::uuid;
 IF (SELECT payment_status FROM pg_temp.orders WHERE id=oid)<>'partially_paid' THEN RAISE EXCEPTION 'Advance marked fully paid'; END IF;
 r:=pg_temp.complete_cashfree_cod_order_atomic(fixture,'Tester','9000000000','Fixture address','[]',null,'',null,false,120);
 IF r->>'already_completed'<>'true' OR (r->>'order_id')::uuid<>oid THEN RAISE EXCEPTION 'COD replay duplicated order'; END IF;
 r:=pg_temp.collect_cod_due_atomic(oid);
 IF r->>'success'<>'false' THEN RAISE EXCEPTION 'Due settled before delivery'; END IF;
 UPDATE pg_temp.orders SET status='delivered',payment_due_amount=300 WHERE id=oid;
 r:=pg_temp.collect_cod_due_atomic(oid);
 IF r->>'success'<>'false' THEN RAISE EXCEPTION 'Inconsistent due settled'; END IF;
 UPDATE pg_temp.orders SET payment_due_amount=-1 WHERE id=oid;
 r:=pg_temp.collect_cod_due_atomic(oid);
 IF r->>'success'<>'false' THEN RAISE EXCEPTION 'Negative due settled'; END IF;
 UPDATE pg_temp.orders SET payment_due_amount=380 WHERE id=oid;
 PERFORM set_config('test.cod_admin','false',true);
 r:=pg_temp.collect_cod_due_atomic(oid);
 IF r->>'success'<>'false' THEN RAISE EXCEPTION 'Non-admin collected'; END IF;
 PERFORM set_config('test.cod_admin','true',true);
 PERFORM set_config('test.cod_branch','false',true);
 r:=pg_temp.collect_cod_due_atomic(oid);
 IF r->>'success'<>'false' THEN RAISE EXCEPTION 'Wrong branch collected'; END IF;
 PERFORM set_config('test.cod_branch','true',true);
 -- A second fixture verifies no-due COD payment is paid.
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,metadata,cashfree_order_id)
 VALUES('[]',120,'processing','{"payment_method":"cod","quote_final":120,"quote_subtotal":0,"quote_delivery":120}','COD-FULL') RETURNING id INTO fixture;
 r:=pg_temp.complete_cashfree_cod_order_atomic(fixture,'Tester','9000000000','Fixture address','[]',null,'',null,false,120);
 IF r->>'success'<>'true' OR (SELECT payment_status FROM pg_temp.orders WHERE id=(r->>'order_id')::uuid)<>'paid' THEN RAISE EXCEPTION 'Fully covered COD not paid'; END IF;
END $test$;
GRANT SELECT,UPDATE ON pg_temp.orders TO authenticated;
SET LOCAL ROLE authenticated;
DO $guardtest$
BEGIN
 BEGIN
  UPDATE pg_temp.orders SET payment_due_amount=0 WHERE order_number='TEST-COD' AND payment_due_amount=380;
  RAISE EXCEPTION 'AUDIT FAILED: direct balance update accepted';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM LIKE 'AUDIT FAILED:%' THEN RAISE; END IF; END;
 BEGIN
  UPDATE pg_temp.orders SET final_amount=999 WHERE order_number='TEST-COD' AND payment_due_amount=380;
  RAISE EXCEPTION 'AUDIT FAILED: direct total update accepted';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN IF SQLERRM LIKE 'AUDIT FAILED:%' THEN RAISE; END IF; END;
END $guardtest$;
-- Settlement SECURITY DEFINER is allowed through the financial trigger, including authenticated admin calls.
DO $settle$
DECLARE oid uuid;r jsonb;BEGIN
 SELECT id INTO oid FROM pg_temp.orders WHERE payment_due_amount=380;
 r:=pg_temp.collect_cod_due_atomic(oid);
 IF r->>'success'<>'true' OR (r->>'amount_collected')::numeric<>380 THEN RAISE EXCEPTION 'Trusted collection blocked: %',r; END IF;
 r:=pg_temp.collect_cod_due_atomic(oid);
 IF r->>'already_settled'<>'true' THEN RAISE EXCEPTION 'Repeated collection not idempotent'; END IF;
END $settle$;
RESET ROLE;
DO $$BEGIN IF (SELECT count(*) FROM pg_temp.admin_audit_log)<>1 THEN RAISE EXCEPTION 'Collection audit duplicated'; END IF; END $$;
SELECT 'PASS COD advance, due, settlement, replay, authorization and direct-update guard tests; only temporary fixtures used' AS result;
ROLLBACK;
