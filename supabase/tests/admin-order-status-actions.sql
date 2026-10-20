-- Sandbox transaction only. Real public status RPC, auth helpers, guards and queues.
BEGIN;
CREATE TEMP TABLE status_fixture(name text PRIMARY KEY,id uuid DEFAULT gen_random_uuid());
INSERT INTO status_fixture(name) VALUES ('in_admin'),('bd_admin'),('master'),('inactive'),('customer'),
 ('in_order'),('bd_order'),('stale'),('rollback'),('protected'),('cancel'),('confirmed'),('processing'),('packed'),('shipped'),('delivered');
INSERT INTO public.admin_users(user_id,email,is_active,role,country_code)
 SELECT id,id::text||'@status-test.invalid',name<>'inactive',CASE WHEN name='master' THEN 'master_admin' ELSE 'admin' END,
 CASE WHEN name='bd_admin' THEN 'BD' ELSE 'IN' END
 FROM status_fixture WHERE name IN ('in_admin','bd_admin','master','inactive');
INSERT INTO public.admin_branch_context(user_id,country_code) SELECT id,'IN' FROM status_fixture WHERE name='master';
INSERT INTO public.orders(id,order_number,customer_name,customer_phone,delivery_address,country_code,status,order_status,
 payment_method,payment_status,final_amount,grand_total,total_amount,subtotal,payment_advance_amount,payment_due_amount,order_source)
 SELECT id,'STATUS-AUDIT-'||id::text,'Synthetic Status Test','9999999999','Synthetic test address',
 CASE WHEN name='bd_order' THEN 'BD' ELSE 'IN' END,
 CASE WHEN name IN ('confirmed','processing','packed','shipped','delivered') THEN name WHEN name='protected' THEN 'packed' ELSE 'pending' END,
 CASE WHEN name IN ('confirmed','processing','packed','shipped','delivered') THEN name WHEN name='protected' THEN 'packed' ELSE 'pending' END,
 CASE WHEN name='protected' THEN 'cashfree' ELSE 'cod' END,CASE WHEN name='protected' THEN 'paid' ELSE 'unpaid' END,
 400,400,400,400,0,CASE WHEN name='protected' THEN 0 ELSE 400 END,'facebook_messenger_ai'
 FROM status_fixture WHERE name IN ('in_order','bd_order','stale','rollback','protected','cancel','confirmed','processing','packed','shipped','delivered');
CREATE TEMP TABLE status_checks(name text PRIMARY KEY,passed boolean NOT NULL);
GRANT SELECT ON status_fixture TO authenticated,anon;
GRANT INSERT,SELECT ON status_checks TO authenticated,anon;
CREATE FUNCTION pg_temp.status_assert(label text,ok boolean) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS NOT TRUE THEN RAISE EXCEPTION 'FAILED: %',label; END IF;
INSERT INTO pg_temp.status_checks VALUES(label,true); END $$;
CREATE FUNCTION pg_temp.status_actor(actor text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',(SELECT id FROM pg_temp.status_fixture WHERE name=actor),'role','authenticated')::text,true);
PERFORM set_config('request.jwt.claim.sub',(SELECT id::text FROM pg_temp.status_fixture WHERE name=actor),true); END $$;
CREATE FUNCTION pg_temp.status_call(fixture text,expected text,target text,reason text DEFAULT '',confirmed boolean DEFAULT false,country text DEFAULT 'IN') RETURNS jsonb LANGUAGE sql AS $$
SELECT public.admin_transition_order_status((SELECT id FROM pg_temp.status_fixture WHERE name=fixture),expected,target,reason,confirmed,country) $$;
SELECT pg_temp.status_assert('anonymous status RPC denied',NOT has_function_privilege('anon','public.admin_transition_order_status(uuid,text,text,text,boolean,text)','EXECUTE'));
SELECT pg_temp.status_assert('anonymous timeline denied',NOT has_function_privilege('anon','public.get_admin_order_status_timeline(uuid)','EXECUTE'));
SELECT pg_temp.status_assert('audit cannot be forged by authenticated',NOT has_table_privilege('authenticated','public.order_status_action_audit','INSERT'));
SET LOCAL ROLE authenticated;
SELECT pg_temp.status_actor('customer');
SELECT pg_temp.status_assert('customer cannot change status',pg_temp.status_call('in_order','pending','confirmed')->>'code'='admin_required');
DO $$ BEGIN
 BEGIN PERFORM * FROM public.get_admin_order_status_timeline((SELECT id FROM status_fixture WHERE name='in_order'));
 RAISE EXCEPTION 'Customer read succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM pg_temp.status_assert('customer timeline rejected',true);
END $$;
SELECT pg_temp.status_actor('inactive');
SELECT pg_temp.status_assert('inactive admin cannot change status',pg_temp.status_call('in_order','pending','confirmed')->>'code'='admin_required');
SELECT pg_temp.status_actor('bd_admin');
SELECT pg_temp.status_assert('Bangladesh cannot change India',pg_temp.status_call('in_order','pending','confirmed','','false','BD')->>'code'='order_unavailable');
DO $$ BEGIN
 BEGIN PERFORM * FROM public.get_admin_order_status_timeline((SELECT id FROM status_fixture WHERE name='in_order'));
 RAISE EXCEPTION 'Cross-branch read succeeded'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM pg_temp.status_assert('cross-branch timeline rejected',true);
END $$;
SELECT pg_temp.status_assert('Bangladesh admin confirms Bangladesh',(pg_temp.status_call('bd_order','pending','confirmed','','false','BD')->>'success')::boolean);
SELECT pg_temp.status_assert('Bangladesh packing begins',(pg_temp.status_call('bd_order','confirmed','processing','',false,'BD')->>'success')::boolean);
SELECT pg_temp.status_assert('Bangladesh packing completes',(pg_temp.status_call('bd_order','processing','packed','items checked',true,'BD')->>'success')::boolean);
SELECT pg_temp.status_assert('Bangladesh handover records',(pg_temp.status_call('bd_order','packed','shipped','courier handover',true,'BD')->>'success')::boolean);
SELECT pg_temp.status_assert('Bangladesh delivery records',(pg_temp.status_call('bd_order','shipped','delivered','buyer confirmed',true,'BD')->>'success')::boolean);
SELECT pg_temp.status_assert('Bangladesh return records',(pg_temp.status_call('bd_order','delivered','returned','parcel received',true,'BD')->>'success')::boolean);
SELECT pg_temp.status_assert('Bangladesh timeline available',EXISTS(SELECT 1 FROM public.get_admin_order_status_timeline((SELECT id FROM status_fixture WHERE name='bd_order')) WHERE previous_status='shipped' AND status='delivered' AND source='admin_manual'));
SELECT pg_temp.status_actor('in_admin');
SELECT pg_temp.status_assert('India cannot change Bangladesh',pg_temp.status_call('bd_order','confirmed','processing')->>'code'='order_unavailable');
SELECT pg_temp.status_assert('stale branch rejected',pg_temp.status_call('in_order','pending','confirmed','','false','BD')->>'code'='branch_changed');
SELECT pg_temp.status_assert('skipping steps rejected',pg_temp.status_call('in_order','pending','delivered','test delivery',true)->>'code'='invalid_transition');
SELECT pg_temp.status_assert('India admin confirms India',(pg_temp.status_call('in_order','pending','confirmed')->>'success')::boolean);
SELECT pg_temp.status_assert('duplicate confirm idempotent',(pg_temp.status_call('in_order','pending','confirmed')->>'already_updated')::boolean);
SELECT pg_temp.status_assert('stale expected status rejected',pg_temp.status_call('in_order','pending','processing')->>'code'='stale_order');
SELECT pg_temp.status_assert('packing begins',(pg_temp.status_call('in_order','confirmed','processing')->>'success')::boolean);
SELECT pg_temp.status_assert('packing confirmation required',pg_temp.status_call('in_order','processing','packed')->>'code'='confirmation_required');
SELECT pg_temp.status_assert('packing completes',(pg_temp.status_call('in_order','processing','packed','checked items',true)->>'success')::boolean);
SELECT pg_temp.status_assert('handover confirmation required',pg_temp.status_call('in_order','packed','shipped')->>'code'='confirmation_required');
SELECT pg_temp.status_assert('handover records',(pg_temp.status_call('in_order','packed','shipped','physical handover',true)->>'success')::boolean);
SELECT pg_temp.status_assert('cannot cancel after handover',pg_temp.status_call('in_order','shipped','cancelled','cancel reason',true)->>'code'='invalid_transition');
SELECT pg_temp.status_assert('delivery reason required',pg_temp.status_call('in_order','shipped','delivered','',true)->>'code'='reason_required');
SELECT pg_temp.status_assert('delivery records',(pg_temp.status_call('in_order','shipped','delivered','buyer confirmed',true)->>'success')::boolean);
SELECT pg_temp.status_assert('return reason required',pg_temp.status_call('in_order','delivered','returned','',true)->>'code'='reason_required');
SELECT pg_temp.status_assert('return records',(pg_temp.status_call('in_order','delivered','returned','return parcel received',true)->>'success')::boolean);
SELECT pg_temp.status_assert('terminal order cannot restart',pg_temp.status_call('in_order','returned','pending')->>'code'='invalid_transition');
SELECT pg_temp.status_assert('cancellation reason required',pg_temp.status_call('cancel','pending','cancelled')->>'code'='reason_required');
SELECT pg_temp.status_assert('cancellation records',(pg_temp.status_call('cancel','pending','cancelled','buyer requested')->>'success')::boolean);
SELECT pg_temp.status_assert('cancelled order cannot restart',pg_temp.status_call('cancel','cancelled','confirmed')->>'code'='invalid_transition');
SELECT pg_temp.status_assert('protected dispatch cannot bypass Cashfree',pg_temp.status_call('protected','packed','shipped','handover checked',true)->>'code'='verified_dispatch_required');
SELECT pg_temp.status_assert('timeline records actual actor and old status',EXISTS(SELECT 1 FROM public.get_admin_order_status_timeline((SELECT id FROM status_fixture WHERE name='in_order')) WHERE previous_status='pending' AND status='confirmed' AND actor_label IS NOT NULL AND source='admin_manual'));
SELECT pg_temp.status_actor('master');
SELECT pg_temp.status_assert('India-context master confirms',(pg_temp.status_call('stale','pending','confirmed')->>'success')::boolean);
RESET ROLE;
SELECT pg_temp.status_assert('status and order_status synchronized',EXISTS(SELECT 1 FROM public.orders WHERE id=(SELECT id FROM status_fixture WHERE name='in_order') AND status='returned' AND order_status='returned'));
SELECT pg_temp.status_assert('status does not mark COD paid',EXISTS(SELECT 1 FROM public.orders WHERE id=(SELECT id FROM status_fixture WHERE name='in_order') AND payment_status='unpaid' AND payment_due_amount=400 AND final_amount=400));
SELECT pg_temp.status_assert('exactly one history per transition',(SELECT count(*) FROM public.order_status_history WHERE order_id=(SELECT id FROM status_fixture WHERE name='in_order'))=6);
SELECT pg_temp.status_assert('exactly one audit per transition',(SELECT count(*) FROM public.order_status_action_audit WHERE order_id=(SELECT id FROM status_fixture WHERE name='in_order'))=6);
SELECT pg_temp.status_assert('notification queue remains deduplicated',(SELECT count(*) FROM public.messenger_order_status_notifications WHERE order_id=(SELECT id FROM status_fixture WHERE name='in_order') AND new_status='shipped')=1);
-- Master Admin branch changes must invalidate a stale India page.
UPDATE public.admin_branch_context SET country_code='BD' WHERE user_id=(SELECT id FROM status_fixture WHERE name='master');
SET LOCAL ROLE authenticated;
SELECT pg_temp.status_actor('master');
SELECT pg_temp.status_assert('master branch switch invalidates stale action',pg_temp.status_call('stale','confirmed','processing')->>'code'='branch_changed');
RESET ROLE;
-- Force audit write failure; all status/history/notification changes must roll back.
ALTER TABLE public.order_status_action_audit ADD CONSTRAINT test_reject_confirm CHECK(new_status<>'confirmed') NOT VALID;
SET LOCAL ROLE authenticated;
SELECT pg_temp.status_actor('in_admin');
SELECT pg_temp.status_assert('audit failure reported',pg_temp.status_call('rollback','pending','confirmed')->>'code'='status_update_failed');
RESET ROLE;
SELECT pg_temp.status_assert('audit failure rolls back order',EXISTS(SELECT 1 FROM public.orders WHERE id=(SELECT id FROM status_fixture WHERE name='rollback') AND status='pending' AND order_status='pending'));
SELECT pg_temp.status_assert('audit failure leaves no history',NOT EXISTS(SELECT 1 FROM public.order_status_history WHERE order_id=(SELECT id FROM status_fixture WHERE name='rollback')));
SELECT pg_temp.status_assert('audit failure leaves no notification',NOT EXISTS(SELECT 1 FROM public.messenger_order_status_notifications WHERE order_id=(SELECT id FROM status_fixture WHERE name='rollback')));
SELECT count(*) AS passed_checks,bool_and(passed) AS all_passed FROM status_checks;
ROLLBACK;
