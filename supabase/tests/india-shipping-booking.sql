-- Sandbox only: all fixtures/state changes are rolled back. No provider calls.
BEGIN;
CREATE TEMP TABLE shipping_results(name text PRIMARY KEY);
CREATE TEMP TABLE shipping_ids(id uuid);
GRANT ALL ON shipping_results,shipping_ids TO service_role;
CREATE FUNCTION pg_temp.shipping_check(n text,ok boolean) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED %',n; END IF; INSERT INTO shipping_results VALUES(n); END $$;
CREATE FUNCTION pg_temp.shipping_denied(n text,q text) RETURNS void LANGUAGE plpgsql AS $$ DECLARE denied boolean:=false; BEGIN BEGIN EXECUTE q; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END; PERFORM pg_temp.shipping_check(n,denied); END $$;
INSERT INTO public.admin_users(user_id,country_code,is_active,role,email) VALUES
('81000000-0000-4000-8000-000000000001','IN',true,'admin','ship-active@example.invalid'),
('81000000-0000-4000-8000-000000000002','BD',true,'admin','ship-bd@example.invalid'),
('81000000-0000-4000-8000-000000000003','IN',false,'admin','ship-inactive@example.invalid');
INSERT INTO public.orders(id,order_number,country_code,status,order_status,payment_method,payment_status,final_amount,grand_total,total_amount,payment_advance_amount,payment_due_amount,customer_phone,order_source,delivery_address)
SELECT ('82000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'SHIP-SQL-'||n,CASE WHEN n=2 THEN 'BD' ELSE 'IN' END,'packed','packed',CASE WHEN n=3 THEN 'cod' ELSE 'cashfree' END,CASE WHEN n=3 THEN 'partially_paid' ELSE 'paid' END,500,500,500,CASE WHEN n=3 THEN 120 ELSE 0 END,CASE WHEN n=3 THEN 380 ELSE 0 END,'9999999999','website','Synthetic test address' FROM generate_series(1,4)n;
INSERT INTO public.india_shipping_preparations(order_id,delivery_pin,weight_kg,length_cm,breadth_cm,height_cm,updated_by)
SELECT id,'110001',0.5,12,10,5,'81000000-0000-4000-8000-000000000001' FROM public.orders WHERE order_number IN ('SHIP-SQL-1','SHIP-SQL-3');
SELECT pg_temp.shipping_check('client reserve denied',NOT has_function_privilege('authenticated','public.reserve_india_shipping_booking(uuid,uuid,text)','EXECUTE'));
SELECT pg_temp.shipping_check('old actor-free reserve disabled',NOT has_function_privilege('service_role','public.reserve_india_shipping_order(uuid,text)','EXECUTE'));
SELECT pg_temp.shipping_check('old actor-free claim disabled',NOT has_function_privilege('service_role','public.claim_india_shipping_creation(uuid)','EXECUTE'));
SELECT pg_temp.shipping_denied('owner cannot forge service claim',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','shipping-test-00001')$q$);
SET LOCAL ROLE service_role;
SELECT pg_temp.shipping_denied('BD admin blocked',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','shipping-test-00001')$q$);
SELECT pg_temp.shipping_denied('inactive admin blocked',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003','shipping-test-00001')$q$);
SELECT pg_temp.shipping_denied('BD order blocked',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','shipping-test-00001')$q$);
SELECT pg_temp.shipping_denied('partial COD booking disabled',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001','shipping-test-00001')$q$);
SELECT pg_temp.shipping_denied('missing parcel blocked',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001','shipping-test-00001')$q$);
INSERT INTO shipping_ids SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','shipping-test-00001');
SELECT pg_temp.shipping_check('reservation created',(SELECT id IS NOT NULL FROM shipping_ids));
SELECT pg_temp.shipping_check('duplicate reserve returns no booking permission',public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','shipping-test-00001') IS NULL);
SELECT pg_temp.shipping_denied('reserved parcel cannot mutate',$q$UPDATE public.india_shipping_preparations SET weight_kg=2 WHERE order_id='82000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.shipping_denied('reserved order cannot mutate',$q$UPDATE public.orders SET final_amount=600 WHERE id='82000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.shipping_check('one creation claim',public.claim_india_shipping_booking((SELECT id FROM shipping_ids),'81000000-0000-4000-8000-000000000001'));
SELECT pg_temp.shipping_check('creation replay blocked',NOT public.claim_india_shipping_booking((SELECT id FROM shipping_ids),'81000000-0000-4000-8000-000000000001'));
SELECT pg_temp.shipping_check('AWB cannot precede external IDs',NOT public.record_india_shipping_awb((SELECT id FROM shipping_ids),'20','TEST-AWB'));
SELECT pg_temp.shipping_check('external IDs persisted',public.record_india_shipping_external_order((SELECT id FROM shipping_ids),'10','20',7));
SELECT pg_temp.shipping_check('external IDs cannot overwrite',NOT public.record_india_shipping_external_order((SELECT id FROM shipping_ids),'11','21',8));
SELECT pg_temp.shipping_check('wrong shipment AWB rejected',NOT public.record_india_shipping_awb((SELECT id FROM shipping_ids),'999','TEST-AWB'));
SELECT pg_temp.shipping_check('AWB persisted',public.record_india_shipping_awb((SELECT id FROM shipping_ids),'20','TEST-AWB'));
SELECT pg_temp.shipping_check('AWB cannot overwrite',NOT public.record_india_shipping_awb((SELECT id FROM shipping_ids),'20','OTHER-AWB'));
SELECT pg_temp.shipping_check('pickup without approval denied',NOT public.claim_india_shipping_pickup((SELECT id FROM shipping_ids)));
SELECT pg_temp.shipping_check('explicit packed pickup approval',public.approve_india_shipping_pickup('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001'));
SELECT pg_temp.shipping_check('approval cannot overwrite actor',NOT public.approve_india_shipping_pickup('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001'));
SELECT pg_temp.shipping_check('approved pickup claim',public.claim_india_shipping_pickup((SELECT id FROM shipping_ids)));
SELECT pg_temp.shipping_check('pickup replay blocked',NOT public.claim_india_shipping_pickup((SELECT id FROM shipping_ids)));
INSERT INTO public.india_shipping_preparations(order_id,delivery_pin,weight_kg,length_cm,breadth_cm,height_cm,updated_by)
VALUES('82000000-0000-4000-8000-000000000004','110001',0.5,12,10,5,'81000000-0000-4000-8000-000000000001');
TRUNCATE shipping_ids;
INSERT INTO shipping_ids SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001','shipping-test-00004');
SELECT pg_temp.shipping_check('uncertain booking claim',public.claim_india_shipping_booking((SELECT id FROM shipping_ids),'81000000-0000-4000-8000-000000000001'));
SELECT public.reconcile_india_shipping_booking((SELECT id FROM shipping_ids));
SELECT pg_temp.shipping_check('uncertain state recorded',(SELECT creation_state='reconcile_required' FROM public.india_shipping_shipments WHERE id=(SELECT id FROM shipping_ids)));
SELECT pg_temp.shipping_check('uncertain booking cannot reclaim',NOT public.claim_india_shipping_booking((SELECT id FROM shipping_ids),'81000000-0000-4000-8000-000000000001'));
SELECT pg_temp.shipping_check('uncertain external IDs cannot bypass reconciliation',NOT public.record_india_shipping_external_order((SELECT id FROM shipping_ids),'99','98',7));
RESET ROLE;
SELECT jsonb_build_object('passed',count(*),'checks',jsonb_agg(name ORDER BY name),'fixtures_rolled_back',true) result FROM shipping_results;
ROLLBACK;
