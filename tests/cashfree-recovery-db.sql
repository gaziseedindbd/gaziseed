-- Run in a transaction. All payment/order fixtures and completion stubs are temporary.
BEGIN;
SET LOCAL request.jwt.claim.role='service_role';
CREATE TEMP TABLE cashfree_payment_intents (LIKE public.cashfree_payment_intents INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TEMP TABLE cashfree_recovery_settings (LIKE public.cashfree_recovery_settings INCLUDING DEFAULTS);
INSERT INTO cashfree_recovery_settings VALUES(true,true,now()-interval '1 hour');
CREATE TEMP TABLE recovered_orders (id uuid DEFAULT gen_random_uuid(), intent_id uuid UNIQUE);
CREATE FUNCTION pg_temp.calculate_cashfree_checkout_quote(jsonb,text,uuid,boolean,text) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_build_object('success',true,'final_amount',coalesce(($1->0->>'total')::numeric,199),'delivery_charge',120);
$$;
CREATE FUNCTION pg_temp.mock_complete(p_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE oid uuid;
BEGIN
 SELECT id INTO oid FROM pg_temp.recovered_orders WHERE intent_id=p_id;
 IF oid IS NOT NULL THEN RETURN jsonb_build_object('success',true,'already_completed',true,'order_id',oid); END IF;
 INSERT INTO pg_temp.recovered_orders(intent_id) VALUES(p_id) RETURNING id INTO oid;
 IF EXISTS(SELECT 1 FROM pg_temp.cashfree_payment_intents WHERE id=p_id AND metadata->>'fail'='true') THEN
   RETURN jsonb_build_object('success',false,'error','Simulated stock failure after insert');
 END IF;
 UPDATE pg_temp.cashfree_payment_intents SET status='completed',completed_order_id=oid WHERE id=p_id;
 RETURN jsonb_build_object('success',true,'order_id',oid);
END;
$$;
CREATE FUNCTION pg_temp.complete_cashfree_campaign_order_atomic(uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT pg_temp.mock_complete($1);$$;
CREATE FUNCTION pg_temp.complete_cashfree_paid_order_atomic(uuid,text,text,text,jsonb,text,text,uuid,boolean) RETURNS jsonb LANGUAGE sql AS $$SELECT pg_temp.mock_complete($1);$$;
CREATE FUNCTION pg_temp.complete_cashfree_cod_order_atomic(uuid,text,text,text,jsonb,text,text,uuid,boolean,numeric) RETURNS jsonb LANGUAGE sql AS $$SELECT pg_temp.mock_complete($1);$$;
DO $copy$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.recover_cashfree_order_atomic(uuid,text,numeric,text)'::regprocedure) INTO definition;
 definition:=replace(definition,'public.','pg_temp.');
 EXECUTE definition;
END;
$copy$;
DO $test$
DECLARE fixture_id uuid; result jsonb; oid text; n integer;
BEGIN
 -- Failed payment attempt followed by a verified successful payment.
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,cashfree_order_id,created_at,updated_at)
 VALUES('[]',199,'failed','db-recovery-failed',now(),now()-interval '20 minutes') RETURNING cashfree_payment_intents.id INTO fixture_id;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-failed',199,'INR');
 IF result->>'success'<>'true' THEN RAISE EXCEPTION 'Failed-state recovery failed: %',result; END IF;
 oid:=result->>'order_id';
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-failed',199,'INR');
 IF result->>'order_id' IS DISTINCT FROM oid OR result->>'already_completed'<>'true' THEN RAISE EXCEPTION 'Replay duplicated order'; END IF;
 SELECT count(*) INTO n FROM pg_temp.recovered_orders WHERE intent_id=fixture_id;
 IF n<>1 THEN RAISE EXCEPTION 'Duplicate order'; END IF;
 -- Stale processing resumes, fresh processing is held.
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,cashfree_order_id,created_at,updated_at)
 VALUES('[]',199,'processing','db-recovery-stale',now(),now()-interval '20 minutes') RETURNING cashfree_payment_intents.id INTO fixture_id;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-stale',199,'INR');
 IF result->>'success'<>'true' THEN RAISE EXCEPTION 'Stale recovery failed'; END IF;
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,cashfree_order_id,created_at,updated_at)
 VALUES('[]',199,'processing','db-recovery-fresh',now(),now()) RETURNING cashfree_payment_intents.id INTO fixture_id;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-fresh',199,'INR');
 IF result->>'processing'<>'true' THEN RAISE EXCEPTION 'Fresh lease was stolen'; END IF;
 -- Failed downstream work rolls back both order insert and processing transition.
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,cashfree_order_id,created_at,metadata)
 VALUES('[]',199,'failed','db-recovery-rollback',now(),'{"fail":true}') RETURNING cashfree_payment_intents.id INTO fixture_id;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-rollback',199,'INR');
 IF result->>'success'<>'false' OR EXISTS(SELECT 1 FROM pg_temp.recovered_orders WHERE intent_id=fixture_id)
    OR (SELECT status FROM pg_temp.cashfree_payment_intents WHERE cashfree_payment_intents.id=fixture_id)<>'failed' THEN
   RAISE EXCEPTION 'Atomic rollback failed';
 END IF;
 -- Old tests and Bangladesh never enter completion.
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,cashfree_order_id,created_at)
 VALUES('[]',199,'failed','db-recovery-old',now()-interval '2 hours') RETURNING cashfree_payment_intents.id INTO fixture_id;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-old',199,'INR');
 IF result->>'success'<>'false' THEN RAISE EXCEPTION 'Old intent recovered'; END IF;
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,cashfree_order_id,country_code)
 VALUES('[]',199,'failed','db-recovery-bd','BD') RETURNING cashfree_payment_intents.id INTO fixture_id;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-bd',199,'INR');
 IF result->>'success'<>'false' THEN RAISE EXCEPTION 'BD intent recovered'; END IF;
 -- Gateway identity/amount/currency and current quote integrity.
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,cashfree_order_id)
 VALUES('[{"total":250}]',199,'failed','db-recovery-integrity') RETURNING cashfree_payment_intents.id INTO fixture_id;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'wrong',199,'INR');
 IF result->>'success'<>'false' THEN RAISE EXCEPTION 'Wrong ID accepted'; END IF;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-integrity',100,'INR');
 IF result->>'success'<>'false' THEN RAISE EXCEPTION 'Wrong amount accepted'; END IF;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-integrity',199,'USD');
 IF result->>'success'<>'false' THEN RAISE EXCEPTION 'Wrong currency accepted'; END IF;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-integrity',199,'INR');
 IF result->>'success'<>'false' OR EXISTS(SELECT 1 FROM pg_temp.recovered_orders WHERE intent_id=fixture_id) THEN RAISE EXCEPTION 'Quote mismatch accepted'; END IF;
 -- COD advance and campaign use the matching atomic completion route.
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,cashfree_order_id,metadata)
 VALUES('[{"total":500}]',120,'failed','db-recovery-cod','{"payment_method":"cod","quote_final":500}') RETURNING cashfree_payment_intents.id INTO fixture_id;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-cod',120,'INR');
 IF result->>'success'<>'true' THEN RAISE EXCEPTION 'COD recovery failed'; END IF;
 INSERT INTO pg_temp.cashfree_payment_intents(items,amount,status,cashfree_order_id,metadata)
 VALUES('[]',199,'failed','db-recovery-campaign','{"payment_flow":"india_campaign"}') RETURNING cashfree_payment_intents.id INTO fixture_id;
 result:=pg_temp.recover_cashfree_order_atomic(fixture_id,'db-recovery-campaign',199,'INR');
 IF result->>'success'<>'true' THEN RAISE EXCEPTION 'Campaign recovery failed'; END IF;
END;
$test$;
SELECT 'PASS 13 temporary-database recovery cases; no live payment/order fixtures changed' AS result;
ROLLBACK;
