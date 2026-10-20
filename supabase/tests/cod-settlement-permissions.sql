-- Sandbox only: real public RPC/auth helpers/financial triggers; every fixture rolls back.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='public.collect_cod_due_atomic(uuid)'::regprocedure
  AND md5(pg_get_functiondef(oid))='12da1672d2ed75ec1d577f1e5389b313') THEN
  RAISE EXCEPTION 'Production-compatible COD function required';
 END IF;
END $$;
CREATE TEMP TABLE cod_fixture(name text PRIMARY KEY,id uuid DEFAULT gen_random_uuid());
INSERT INTO cod_fixture(name) VALUES ('india_admin'),('bd_admin'),('inactive_admin'),('customer'),('master_admin'),
 ('valid'),('packed'),('prepaid'),('mismatch'),('bd_order'),('master_order');
INSERT INTO public.admin_users(user_id,email,is_active,role,country_code)
 SELECT id,id::text||'@cod-test.invalid',name<>'inactive_admin',CASE WHEN name='master_admin' THEN 'master_admin' ELSE 'admin' END,
 CASE WHEN name='bd_admin' THEN 'BD' ELSE 'IN' END
 FROM cod_fixture WHERE name IN ('india_admin','bd_admin','inactive_admin','master_admin');
INSERT INTO public.admin_branch_context(user_id,country_code)
 SELECT id,'IN' FROM cod_fixture WHERE name='master_admin';
INSERT INTO public.orders(id,order_number,customer_name,customer_phone,delivery_address,country_code,
 status,order_status,payment_method,payment_status,final_amount,grand_total,total_amount,subtotal,
 payment_advance_amount,payment_due_amount)
 SELECT id,'COD-AUDIT-'||id::text,'Synthetic COD Audit','9999999999','Synthetic test address',
 CASE WHEN name='bd_order' THEN 'BD' ELSE 'IN' END,
 CASE WHEN name='packed' THEN 'packed' ELSE 'delivered' END,
 CASE WHEN name='packed' THEN 'packed' ELSE 'delivered' END,
 CASE WHEN name='prepaid' THEN 'cashfree' ELSE 'cod' END,'partially_paid',400,400,400,400,100,
 CASE WHEN name='mismatch' THEN 250 ELSE 300 END
 FROM cod_fixture WHERE name IN ('valid','packed','prepaid','mismatch','bd_order','master_order');
CREATE TEMP TABLE cod_checks(name text PRIMARY KEY,passed boolean NOT NULL);
GRANT SELECT ON cod_fixture TO authenticated,anon;
GRANT SELECT,INSERT ON cod_checks TO authenticated,anon;
CREATE FUNCTION pg_temp.cod_assert(label text,ok boolean) RETURNS void LANGUAGE plpgsql AS $$
 BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %',label; END IF;
 INSERT INTO pg_temp.cod_checks VALUES(label,true); END $$;
CREATE FUNCTION pg_temp.cod_actor(actor text) RETURNS void LANGUAGE plpgsql AS $$
 BEGIN PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT id FROM pg_temp.cod_fixture WHERE name=actor),'role','authenticated','email','synthetic@cod-test.invalid')::text,true);
 PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM pg_temp.cod_fixture WHERE name=actor),true); END $$;
SELECT pg_temp.cod_assert('authenticated entry point granted',has_function_privilege('authenticated','public.collect_cod_due_atomic(uuid)','EXECUTE'));
SELECT pg_temp.cod_assert('anonymous entry point denied',NOT has_function_privilege('anon','public.collect_cod_due_atomic(uuid)','EXECUTE'));
SET LOCAL ROLE authenticated;
SELECT pg_temp.cod_actor('customer');
SELECT pg_temp.cod_assert('customer blocked',public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='valid'))->>'error'='Admin access required');
SELECT pg_temp.cod_actor('inactive_admin');
SELECT pg_temp.cod_assert('inactive admin blocked',public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='valid'))->>'error'='Admin access required');
SELECT pg_temp.cod_actor('bd_admin');
SELECT pg_temp.cod_assert('Bangladesh admin blocked from India',public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='valid'))->>'error'='Order is outside the current admin branch');
SELECT pg_temp.cod_actor('india_admin');
SELECT pg_temp.cod_assert('India admin blocked from Bangladesh',public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='bd_order'))->>'error'='Order is outside the current admin branch');
SELECT pg_temp.cod_assert('undelivered COD blocked',public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='packed'))->>'error'='COD due can only be collected after delivery');
SELECT pg_temp.cod_assert('prepaid blocked',public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='prepaid'))->>'error'='Only India COD orders can be settled here');
SELECT pg_temp.cod_assert('incorrect amount blocked',public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='mismatch'))->>'error'='COD advance and due do not match total. Hold settlement.');
SELECT pg_temp.cod_assert('missing order blocked',public.collect_cod_due_atomic(gen_random_uuid())->>'error'='Order not found');
DO $$ DECLARE result jsonb; BEGIN
 result:=public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='valid'));
 PERFORM pg_temp.cod_assert('delivered India COD settles',(result->>'success')::boolean AND (result->>'amount_collected')::numeric=300 AND (result->>'due_amount')::numeric=0);
 result:=public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='valid'));
 PERFORM pg_temp.cod_assert('duplicate collection is idempotent',(result->>'success')::boolean AND (result->>'already_settled')::boolean);
END $$;
SELECT pg_temp.cod_actor('master_admin');
SELECT pg_temp.cod_assert('India master admin settles',(public.collect_cod_due_atomic((SELECT id FROM cod_fixture WHERE name='master_order'))->>'success')::boolean);
RESET ROLE;
SELECT pg_temp.cod_assert('database paid/due persisted correctly',EXISTS(SELECT 1 FROM public.orders WHERE id=(SELECT id FROM cod_fixture WHERE name='valid') AND payment_status='paid' AND payment_due_amount=0 AND payment_advance_amount=100 AND final_amount=400 AND status='delivered'));
SELECT pg_temp.cod_assert('one admin audit despite duplicate',(SELECT count(*) FROM public.admin_audit_log WHERE details->>'order_id'=(SELECT id::text FROM cod_fixture WHERE name='valid') AND action='collect_cod_due')=1);
SELECT pg_temp.cod_assert('one payment audit despite duplicate',(SELECT count(*) FROM public.payment_security_audit_log WHERE order_id=(SELECT id FROM cod_fixture WHERE name='valid') AND event_type='cod_due_collected' AND (details->>'amount_collected')::numeric=300)=1);
SELECT pg_temp.cod_assert('rejected orders unchanged',(SELECT count(*) FROM public.orders WHERE id IN (SELECT id FROM cod_fixture WHERE name IN ('packed','prepaid','mismatch','bd_order')) AND payment_status='partially_paid' AND payment_due_amount=CASE WHEN id=(SELECT id FROM cod_fixture WHERE name='mismatch') THEN 250 ELSE 300 END)=4);
SELECT pg_temp.cod_assert('rejected operations produced no collection audit',NOT EXISTS(SELECT 1 FROM public.payment_security_audit_log WHERE order_id IN (SELECT id FROM cod_fixture WHERE name IN ('packed','prepaid','mismatch','bd_order')) AND event_type='cod_due_collected'));
SELECT count(*) AS passed_checks,bool_and(passed) AS all_passed FROM cod_checks;
ROLLBACK;
