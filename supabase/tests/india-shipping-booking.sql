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
INSERT INTO public.orders(id,order_number,country_code,status,order_status,payment_method,payment_status,final_amount,grand_total,total_amount,payment_advance_amount,payment_due_amount,customer_phone,order_source,delivery_address,customer_name,subtotal)
SELECT ('82000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'SHIP-SQL-'||n,CASE WHEN n=2 THEN 'BD' ELSE 'IN' END,'packed','packed',CASE WHEN n=3 THEN 'cod' ELSE 'cashfree' END,CASE WHEN n=3 THEN 'partially_paid' ELSE 'paid' END,500,500,500,CASE WHEN n=3 THEN 120 ELSE 0 END,CASE WHEN n=3 THEN 380 ELSE 0 END,'9999999999','website','Synthetic test address','Synthetic Customer',500 FROM generate_series(1,4)n;
INSERT INTO public.india_shipping_preparations(order_id,delivery_pin,weight_kg,length_cm,breadth_cm,height_cm,updated_by)
SELECT id,'110001',0.5,12,10,5,'81000000-0000-4000-8000-000000000001' FROM public.orders WHERE order_number IN ('SHIP-SQL-1','SHIP-SQL-3');
INSERT INTO public.order_items(order_id,product_name,quantity,unit_price,total_price,country_code)
SELECT id,'Synthetic Seeds',1,500,500,'IN' FROM public.orders WHERE order_number IN ('SHIP-SQL-1','SHIP-SQL-4');
INSERT INTO public.cashfree_payment_intents(completed_order_id,cashfree_order_id,country_code,currency,status,amount,items,metadata)
SELECT id,'SHIP-CONTEXT-'||order_number,'IN','INR','completed',500,'[]','{}' FROM public.orders WHERE order_number IN ('SHIP-SQL-1','SHIP-SQL-4');
SET LOCAL ROLE service_role;
SELECT public.confirm_india_shipping_destination('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Delhi','Delhi','110001');
RESET ROLE;
SELECT pg_temp.shipping_check('client reserve denied',NOT has_function_privilege('authenticated','public.reserve_india_shipping_booking(uuid,uuid,text)','EXECUTE'));
SELECT pg_temp.shipping_check('old actor-free reserve disabled',NOT has_function_privilege('service_role','public.reserve_india_shipping_order(uuid,text)','EXECUTE'));
SELECT pg_temp.shipping_check('old actor-free claim disabled',NOT has_function_privilege('service_role','public.claim_india_shipping_creation(uuid)','EXECUTE'));
SELECT pg_temp.shipping_denied('owner cannot forge service claim',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','GS'||substr(md5('82000000-0000-4000-8000-000000000001'),1,18))$q$);
SET LOCAL ROLE service_role;
SELECT pg_temp.shipping_denied('BD admin blocked',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','GS'||substr(md5('82000000-0000-4000-8000-000000000001'),1,18))$q$);
SELECT pg_temp.shipping_denied('inactive admin blocked',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003','GS'||substr(md5('82000000-0000-4000-8000-000000000001'),1,18))$q$);
SELECT pg_temp.shipping_denied('BD order blocked',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','GS'||substr(md5('82000000-0000-4000-8000-000000000001'),1,18))$q$);
SELECT pg_temp.shipping_denied('partial COD booking disabled',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001','GS'||substr(md5('82000000-0000-4000-8000-000000000001'),1,18))$q$);
SELECT pg_temp.shipping_denied('missing parcel blocked',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001','GS'||substr(md5('82000000-0000-4000-8000-000000000001'),1,18))$q$);
SELECT pg_temp.shipping_check('canonical context available',public.get_india_shipping_booking_context('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001') IS NOT NULL);
UPDATE public.orders SET delivery_address='Changed address' WHERE id='82000000-0000-4000-8000-000000000001';
SELECT pg_temp.shipping_check('stale address confirmation rejected',public.get_india_shipping_booking_context('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001') IS NULL);
UPDATE public.orders SET delivery_address='Synthetic test address' WHERE id='82000000-0000-4000-8000-000000000001';
UPDATE public.order_items SET total_price=499 WHERE order_id='82000000-0000-4000-8000-000000000001';
SELECT pg_temp.shipping_check('inconsistent item total rejected',public.get_india_shipping_booking_context('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001') IS NULL);
UPDATE public.order_items SET total_price=500,country_code='BD' WHERE order_id='82000000-0000-4000-8000-000000000001';
SELECT pg_temp.shipping_check('cross branch item rejected',public.get_india_shipping_booking_context('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001') IS NULL);
UPDATE public.order_items SET country_code='IN' WHERE order_id='82000000-0000-4000-8000-000000000001';
UPDATE public.orders SET subtotal=499 WHERE id='82000000-0000-4000-8000-000000000001';
SELECT pg_temp.shipping_check('invoice mismatch rejected',public.get_india_shipping_booking_context('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001') IS NULL);
UPDATE public.orders SET subtotal=500,wallet_credit_used=1 WHERE id='82000000-0000-4000-8000-000000000001';
SELECT pg_temp.shipping_check('wallet requires explicit reconciliation',public.get_india_shipping_booking_context('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001') IS NULL);
UPDATE public.orders SET wallet_credit_used=0 WHERE id='82000000-0000-4000-8000-000000000001';
UPDATE public.cashfree_payment_intents SET currency='USD' WHERE completed_order_id='82000000-0000-4000-8000-000000000001';
SELECT pg_temp.shipping_check('intent currency rejected',public.get_india_shipping_booking_context('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001') IS NULL);
UPDATE public.cashfree_payment_intents SET currency='INR' WHERE completed_order_id='82000000-0000-4000-8000-000000000001';
SELECT pg_temp.shipping_denied('wrong confirmation PIN rejected',$q$SELECT public.confirm_india_shipping_destination('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Delhi','Delhi','700016')$q$);
SELECT pg_temp.shipping_denied('forged provider request key rejected',$q$SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','forged-key-000000001')$q$);
INSERT INTO shipping_ids SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','GS'||substr(md5('82000000-0000-4000-8000-000000000001'),1,18));
SELECT pg_temp.shipping_check('reservation created',(SELECT id IS NOT NULL FROM shipping_ids));
SELECT pg_temp.shipping_check('duplicate reserve returns no booking permission',public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','GS'||substr(md5('82000000-0000-4000-8000-000000000001'),1,18)) IS NULL);
SELECT pg_temp.shipping_denied('reserved parcel cannot mutate',$q$UPDATE public.india_shipping_preparations SET weight_kg=2 WHERE order_id='82000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.shipping_denied('reserved order cannot mutate',$q$UPDATE public.orders SET final_amount=600 WHERE id='82000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.shipping_denied('reserved items cannot mutate',$q$UPDATE public.order_items SET unit_price=600 WHERE order_id='82000000-0000-4000-8000-000000000001'$q$);
SELECT pg_temp.shipping_denied('reserved destination cannot mutate',$q$UPDATE public.india_shipping_destinations SET city='Mumbai' WHERE order_id='82000000-0000-4000-8000-000000000001'$q$);
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
SELECT public.confirm_india_shipping_destination('82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001','Delhi','Delhi','110001');
TRUNCATE shipping_ids;
INSERT INTO shipping_ids SELECT public.reserve_india_shipping_booking('82000000-0000-4000-8000-000000000004','81000000-0000-4000-8000-000000000001','GS'||substr(md5('82000000-0000-4000-8000-000000000004'),1,18));
SELECT pg_temp.shipping_check('uncertain booking claim',public.claim_india_shipping_booking((SELECT id FROM shipping_ids),'81000000-0000-4000-8000-000000000001'));
SELECT public.reconcile_india_shipping_booking((SELECT id FROM shipping_ids));
SELECT pg_temp.shipping_check('uncertain state recorded',(SELECT creation_state='reconcile_required' FROM public.india_shipping_shipments WHERE id=(SELECT id FROM shipping_ids)));
SELECT pg_temp.shipping_check('uncertain booking cannot reclaim',NOT public.claim_india_shipping_booking((SELECT id FROM shipping_ids),'81000000-0000-4000-8000-000000000001'));
SELECT pg_temp.shipping_check('uncertain external IDs cannot bypass reconciliation',NOT public.record_india_shipping_external_order((SELECT id FROM shipping_ids),'99','98',7));
RESET ROLE;
SELECT jsonb_build_object('passed',count(*),'checks',jsonb_agg(name ORDER BY name),'fixtures_rolled_back',true) result FROM shipping_results;
ROLLBACK;
