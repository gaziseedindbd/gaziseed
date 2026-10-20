-- SANDBOX ONLY. All synthetic fixtures and simulated evidence roll back.
BEGIN;
CREATE TEMP TABLE port_results(name text PRIMARY KEY,passed boolean NOT NULL);
CREATE FUNCTION pg_temp.check_port(p_name text,p_ok boolean) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF p_ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %',p_name; END IF; INSERT INTO port_results VALUES(p_name,true); END $$;
CREATE FUNCTION pg_temp.denied_port(p_name text,p_sql text) RETURNS void LANGUAGE plpgsql AS $$ DECLARE blocked boolean:=false; BEGIN BEGIN EXECUTE p_sql; EXCEPTION WHEN insufficient_privilege OR unique_violation OR check_violation THEN blocked:=true; END; PERFORM pg_temp.check_port(p_name,blocked); END $$;
GRANT ALL ON port_results TO service_role,authenticated,security_test_evidence_writer;
INSERT INTO public.admin_users(user_id,country_code,is_active,role,email) VALUES
('71000000-0000-4000-8000-000000000001','IN',true,'admin','active@example.invalid'),('71000000-0000-4000-8000-000000000002','IN',false,'admin','inactive@example.invalid'),('71000000-0000-4000-8000-000000000003','BD',true,'admin','bd@example.invalid');
INSERT INTO public.orders(id,order_number,country_code,status,order_status,payment_method,payment_status,final_amount,grand_total,total_amount,payment_advance_amount,payment_due_amount,customer_phone,order_source)
SELECT ('72000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'PORT-'||n,CASE WHEN n=10 THEN 'BD' ELSE 'IN' END,'packed','packed',CASE WHEN n IN (4,10) THEN 'cod' ELSE 'cashfree' END,CASE WHEN n=4 THEN 'partially_paid' WHEN n=10 THEN 'unpaid' ELSE 'paid' END,CASE WHEN n=4 THEN 4 ELSE 1 END,CASE WHEN n=4 THEN 4 ELSE 1 END,CASE WHEN n=4 THEN 4 ELSE 1 END,CASE WHEN n=10 THEN 0 ELSE 1 END,CASE WHEN n=4 THEN 3 WHEN n=10 THEN 1 ELSE 0 END,'9999999999',CASE WHEN n=1 THEN 'facebook_messenger_ai' ELSE 'website' END FROM generate_series(1,14)n;
INSERT INTO public.cashfree_payment_intents(id,completed_order_id,cashfree_order_id,country_code,currency,status,amount,items,metadata)
SELECT ('73000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,('72000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'PORT-GW-'||n,'IN','INR','completed',1,'[]',CASE WHEN n=4 THEN '{"payment_method":"cod"}'::jsonb ELSE '{}' END FROM generate_series(1,14)n WHERE n<>10;
INSERT INTO cashfree_dispatch_private.evidence(order_id,intent_id,provider_order_id,provider_payment_id,amount,currency,total_snapshot,advance_snapshot,due_snapshot,method_snapshot)
SELECT o.id,i.id,i.cashfree_order_id,'PORT-PAY-'||o.order_number,1,'INR',o.final_amount,o.payment_advance_amount,o.payment_due_amount,o.payment_method FROM public.orders o JOIN public.cashfree_payment_intents i ON i.completed_order_id=o.id WHERE o.order_number LIKE 'PORT-%' AND o.order_number<>'PORT-2';
UPDATE cashfree_dispatch_private.evidence SET verified_at=clock_timestamp()-interval '6 minutes' WHERE order_id='72000000-0000-4000-8000-000000000006';
UPDATE cashfree_dispatch_private.evidence SET revoked_at=clock_timestamp() WHERE order_id='72000000-0000-4000-8000-000000000007';
UPDATE cashfree_dispatch_private.evidence SET consumed_at=clock_timestamp() WHERE order_id='72000000-0000-4000-8000-000000000013';
UPDATE public.orders SET final_amount=2 WHERE id='72000000-0000-4000-8000-000000000011';
INSERT INTO public.cashfree_payment_intents(completed_order_id,cashfree_order_id,country_code,currency,status,amount,items) VALUES('72000000-0000-4000-8000-000000000012','PORT-DUP','IN','INR','completed',1,'[]');
CREATE FUNCTION pg_temp.fail_audit_port() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.order_id='72000000-0000-4000-8000-000000000014' THEN RAISE EXCEPTION 'Injected audit failure' USING ERRCODE='23514'; END IF; RETURN NEW; END $$;
CREATE TRIGGER port_fail_audit BEFORE INSERT ON public.payment_security_audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_audit_port();
SET LOCAL ROLE service_role;
SELECT pg_temp.denied_port('timestamp-only bypass',$q$UPDATE public.orders SET cashfree_dispatch_verified_at=clock_timestamp() WHERE id='72000000-0000-4000-8000-000000000003'$q$);
SELECT pg_temp.denied_port('direct status bypass',$q$UPDATE public.orders SET status='shipped' WHERE id='72000000-0000-4000-8000-000000000003'$q$);
SELECT pg_temp.denied_port('alias status bypass',$q$UPDATE public.orders SET order_status='shipped' WHERE id='72000000-0000-4000-8000-000000000003'$q$);
SELECT pg_temp.denied_port('forged request claim bypass',$q$DO $x$ BEGIN PERFORM set_config('request.jwt.claim.role','service_role',true); UPDATE public.orders SET status='shipped',cashfree_dispatch_verified_at=clock_timestamp() WHERE id='72000000-0000-4000-8000-000000000003'; END $x$$q$);
SELECT pg_temp.denied_port('India branch downgrade',$q$UPDATE public.orders SET country_code='BD' WHERE id='72000000-0000-4000-8000-000000000003'$q$);
UPDATE public.cashfree_payment_intents SET completed_order_id=NULL WHERE completed_order_id='72000000-0000-4000-8000-000000000005';
UPDATE public.orders SET payment_method='cod',payment_status='unpaid',payment_advance_amount=0,payment_due_amount=1 WHERE id='72000000-0000-4000-8000-000000000005';
SELECT pg_temp.denied_port('downgraded payment classification still protected',$q$UPDATE public.orders SET status='shipped' WHERE id='72000000-0000-4000-8000-000000000005'$q$);
SELECT pg_temp.denied_port('service-role evidence insert',$q$INSERT INTO cashfree_dispatch_private.evidence(order_id) VALUES('72000000-0000-4000-8000-000000000003')$q$);
SELECT pg_temp.denied_port('service-role writer RPC',$q$SELECT public.record_cashfree_dispatch_evidence('72000000-0000-4000-8000-000000000003','73000000-0000-4000-8000-000000000003','PORT-GW-3','FAKE',1,'INR')$q$);
SELECT pg_temp.denied_port('missing evidence',$q$SELECT public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000002','PORT-GW-2',1,1,0,'test')$q$);
SELECT pg_temp.denied_port('stale evidence',$q$SELECT public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000006','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000006','PORT-GW-6',1,1,0,'test')$q$);
SELECT pg_temp.denied_port('revoked evidence',$q$SELECT public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000007','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000007','PORT-GW-7',1,1,0,'test')$q$);
SELECT pg_temp.denied_port('consumed evidence',$q$SELECT public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000013','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000013','PORT-GW-13',1,1,0,'test')$q$);
SELECT pg_temp.denied_port('inactive actor',$q$SELECT public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000008','71000000-0000-4000-8000-000000000002','73000000-0000-4000-8000-000000000008','PORT-GW-8',1,1,0,'test')$q$);
SELECT pg_temp.denied_port('BD actor',$q$SELECT public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000009','71000000-0000-4000-8000-000000000003','73000000-0000-4000-8000-000000000009','PORT-GW-9',1,1,0,'test')$q$);
SELECT pg_temp.denied_port('audit failure aborts dispatch',$q$SELECT public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000014','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000014','PORT-GW-14',1,1,0,'test')$q$);
SELECT pg_temp.check_port('changed snapshot',NOT ((public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000011','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000011','PORT-GW-11',1,1,0,'test'))->>'success')::boolean);
SELECT pg_temp.check_port('duplicate intent',NOT ((public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000012','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000012','PORT-GW-12',1,1,0,'test'))->>'success')::boolean);
SELECT pg_temp.check_port('prepaid works',((public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','PORT-GW-1',1,1,0,'test'))->>'success')::boolean);
SELECT pg_temp.check_port('COD advance works',((public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000004','PORT-GW-4',4,1,3,'test'))->>'success')::boolean);
SELECT pg_temp.check_port('shipped replay blocked',NOT ((public.dispatch_verified_cashfree_order('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','PORT-GW-1',1,1,0,'test'))->>'success')::boolean);
UPDATE public.orders SET status='shipped' WHERE id='72000000-0000-4000-8000-000000000010';
SELECT pg_temp.check_port('ordinary BD preserved',(SELECT status='shipped' AND order_status='shipped' FROM public.orders WHERE id='72000000-0000-4000-8000-000000000010'));
INSERT INTO public.order_status_history(order_id,status,note) VALUES('72000000-0000-4000-8000-000000000001','shipped','old bundle retry');
RESET ROLE;
SELECT pg_temp.check_port('history deduplicated',(SELECT count(*)=1 FROM public.order_status_history WHERE order_id='72000000-0000-4000-8000-000000000001'));
SELECT pg_temp.check_port('notification once',(SELECT count(*)=1 FROM public.messenger_order_status_notifications WHERE order_id='72000000-0000-4000-8000-000000000001' AND new_status='shipped'));
SELECT pg_temp.check_port('evidence consumed',(SELECT consumed_at IS NOT NULL FROM cashfree_dispatch_private.evidence WHERE order_id='72000000-0000-4000-8000-000000000001'));
SELECT pg_temp.check_port('markers cleaned',(SELECT count(*)=0 FROM cashfree_dispatch_private.authorizations));
SELECT pg_temp.check_port('atomic failure rollback',(SELECT status='packed' FROM public.orders WHERE id='72000000-0000-4000-8000-000000000014') AND (SELECT consumed_at IS NULL FROM cashfree_dispatch_private.evidence WHERE order_id='72000000-0000-4000-8000-000000000014') AND NOT EXISTS(SELECT 1 FROM public.order_status_history WHERE order_id='72000000-0000-4000-8000-000000000014'));
SELECT pg_temp.check_port('writer cannot update orders',NOT has_table_privilege('security_test_evidence_writer','public.orders','UPDATE'));
SELECT pg_temp.check_port('writer cannot dispatch',NOT has_function_privilege('security_test_evidence_writer','public.dispatch_verified_cashfree_order(uuid,uuid,uuid,text,numeric,numeric,numeric,text)','EXECUTE'));
SELECT pg_temp.denied_port('owner cannot forge writer session',$q$SELECT public.record_cashfree_dispatch_evidence('72000000-0000-4000-8000-000000000003','73000000-0000-4000-8000-000000000003','PORT-GW-3','FAKE',1,'INR')$q$);
SELECT jsonb_build_object('passed',count(*),'checks',jsonb_agg(name ORDER BY name),'fixtures_rolled_back',true) result FROM port_results;
ROLLBACK;

