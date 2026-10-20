-- Sandbox-only metadata clone; no Production rows, network hooks or secrets.
CREATE TABLE public."admin_branch_context" (
"user_id" uuid NOT NULL,
"country_code" text DEFAULT 'BD'::text NOT NULL,
"updated_at" timestamptz DEFAULT now() NOT NULL
);
ALTER TABLE public."admin_branch_context" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."admin_branch_context" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."admin_branch_context" TO service_role;
CREATE TABLE public."admin_users" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"user_id" uuid NOT NULL,
"email" text DEFAULT ''::text NOT NULL,
"is_active" bool DEFAULT true NOT NULL,
"created_at" timestamptz DEFAULT now(),
"role" text DEFAULT 'admin'::text,
"full_name" text,
"name" text,
"country_code" text
);
ALTER TABLE public."admin_users" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."admin_users" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."admin_users" TO service_role;
CREATE TABLE public."cashfree_payment_intents" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"cashfree_order_id" text,
"cf_order_id" text,
"user_id" uuid,
"country_code" text DEFAULT 'IN'::text NOT NULL,
"amount" numeric NOT NULL,
"currency" text DEFAULT 'INR'::text NOT NULL,
"status" text DEFAULT 'created'::text NOT NULL,
"customer_details" jsonb DEFAULT '{}'::jsonb NOT NULL,
"delivery_address" text DEFAULT ''::text NOT NULL,
"special_instructions" text DEFAULT ''::text NOT NULL,
"items" jsonb NOT NULL,
"coupon_code" text,
"use_referral_wallet" bool DEFAULT false NOT NULL,
"wallet_credit_used" numeric DEFAULT 0 NOT NULL,
"created_at" timestamptz DEFAULT now() NOT NULL,
"updated_at" timestamptz DEFAULT now() NOT NULL,
"paid_at" timestamptz,
"completed_order_id" uuid,
"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
"cashfree_payment_session_id" text,
"return_url" text,
"notify_url" text,
"recovery_next_attempt_at" timestamptz,
"recovery_attempts" int4 DEFAULT 0 NOT NULL,
"recovery_last_error" text
);
ALTER TABLE public."cashfree_payment_intents" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."cashfree_payment_intents" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."cashfree_payment_intents" TO service_role;
CREATE TABLE public."order_status_history" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"order_id" uuid NOT NULL,
"status" text NOT NULL,
"note" text DEFAULT ''::text,
"created_at" timestamptz DEFAULT now()
);
ALTER TABLE public."order_status_history" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."order_status_history" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."order_status_history" TO service_role;
CREATE TABLE public."orders" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"order_number" text NOT NULL,
"user_id" uuid,
"customer_name" text DEFAULT ''::text NOT NULL,
"customer_phone" text DEFAULT ''::text NOT NULL,
"customer_email" text DEFAULT ''::text,
"delivery_address" text DEFAULT ''::text NOT NULL,
"delivery_zone_id" uuid,
"delivery_zone_name" text DEFAULT ''::text,
"delivery_charge" numeric DEFAULT 0 NOT NULL,
"special_instructions" text DEFAULT ''::text,
"subtotal" numeric DEFAULT 0 NOT NULL,
"discount" numeric DEFAULT 0 NOT NULL,
"grand_total" numeric DEFAULT 0 NOT NULL,
"payment_method" text DEFAULT 'cod'::text NOT NULL,
"order_source" text DEFAULT 'website'::text NOT NULL,
"utm_source" text DEFAULT ''::text,
"utm_medium" text DEFAULT ''::text,
"utm_campaign" text DEFAULT ''::text,
"utm_content" text DEFAULT ''::text,
"utm_term" text DEFAULT ''::text,
"fbclid" text DEFAULT ''::text,
"gclid" text DEFAULT ''::text,
"status" text DEFAULT 'pending'::text NOT NULL,
"internal_notes" text DEFAULT ''::text,
"coupon_code" text DEFAULT ''::text,
"created_at" timestamptz DEFAULT now(),
"updated_at" timestamptz DEFAULT now(),
"payment_status" text DEFAULT 'unpaid'::text,
"discount_amount" numeric DEFAULT 0,
"total_amount" numeric DEFAULT 0,
"final_amount" numeric DEFAULT 0,
"customer_address" text,
"landing_page_id" uuid,
"district" text,
"thana" text,
"items" jsonb DEFAULT '[]'::jsonb,
"cart_items" jsonb DEFAULT '[]'::jsonb,
"order_status" text DEFAULT 'pending'::text,
"shipping_fee" numeric DEFAULT 0,
"quantity_selected" int4 DEFAULT 1,
"wallet_credit_used" numeric DEFAULT 0 NOT NULL,
"country_code" text DEFAULT 'BD'::text NOT NULL,
"payment_advance_amount" numeric DEFAULT 0 NOT NULL,
"payment_due_amount" numeric DEFAULT 0 NOT NULL,
"inventory_restored_at" timestamptz,
"checkout_idempotency_key" uuid,
"cashfree_dispatch_verified_at" timestamptz
);
ALTER TABLE public."orders" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."orders" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."orders" TO service_role;
CREATE TABLE public."payment_security_audit_log" (
"id" uuid DEFAULT gen_random_uuid() NOT NULL,
"created_at" timestamptz DEFAULT clock_timestamp() NOT NULL,
"country_code" text NOT NULL,
"order_id" uuid,
"payment_intent_id" uuid,
"actor_type" text NOT NULL,
"actor_id" uuid,
"event_type" text NOT NULL,
"outcome" text NOT NULL,
"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
"event_key" text
);
ALTER TABLE public."payment_security_audit_log" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public."payment_security_audit_log" FROM PUBLIC,anon,authenticated;
GRANT ALL ON public."payment_security_audit_log" TO service_role;
ALTER TABLE public."admin_branch_context" ADD CONSTRAINT "admin_branch_context_country_code_check" CHECK ((upper(country_code) = ANY (ARRAY['BD'::text, 'IN'::text])));
ALTER TABLE public."admin_branch_context" ADD CONSTRAINT "admin_branch_context_pkey" PRIMARY KEY (user_id);
ALTER TABLE public."admin_users" ADD CONSTRAINT "admin_users_country_code_check" CHECK (((country_code IS NULL) OR (country_code = ANY (ARRAY['BD'::text, 'IN'::text]))));
ALTER TABLE public."admin_users" ADD CONSTRAINT "admin_users_email_key" UNIQUE (email);
ALTER TABLE public."admin_users" ADD CONSTRAINT "admin_users_pkey" PRIMARY KEY (id);
ALTER TABLE public."admin_users" ADD CONSTRAINT "admin_users_user_id_key" UNIQUE (user_id);
ALTER TABLE public."cashfree_payment_intents" ADD CONSTRAINT "cashfree_payment_intents_amount_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."cashfree_payment_intents" ADD CONSTRAINT "cashfree_payment_intents_cashfree_order_id_key" UNIQUE (cashfree_order_id);
ALTER TABLE public."cashfree_payment_intents" ADD CONSTRAINT "cashfree_payment_intents_pkey" PRIMARY KEY (id);
ALTER TABLE public."order_status_history" ADD CONSTRAINT "order_status_history_pkey" PRIMARY KEY (id);
ALTER TABLE public."orders" ADD CONSTRAINT "orders_country_code_check" CHECK ((country_code = ANY (ARRAY['BD'::text, 'IN'::text])));
ALTER TABLE public."orders" ADD CONSTRAINT "orders_order_number_key" UNIQUE (order_number);
ALTER TABLE public."orders" ADD CONSTRAINT "orders_pkey" PRIMARY KEY (id);
ALTER TABLE public."payment_security_audit_log" ADD CONSTRAINT "payment_security_audit_log_actor_type_check" CHECK ((actor_type = ANY (ARRAY['admin'::text, 'system'::text])));
ALTER TABLE public."payment_security_audit_log" ADD CONSTRAINT "payment_security_audit_log_check" CHECK ((((actor_type = 'admin'::text) AND (actor_id IS NOT NULL)) OR ((actor_type = 'system'::text) AND (actor_id IS NULL))));
ALTER TABLE public."payment_security_audit_log" ADD CONSTRAINT "payment_security_audit_log_country_code_check" CHECK ((country_code = ANY (ARRAY['IN'::text, 'BD'::text])));
ALTER TABLE public."payment_security_audit_log" ADD CONSTRAINT "payment_security_audit_log_details_check" CHECK (((jsonb_typeof(details) = 'object'::text) AND (octet_length((details)::text) <= 4096)));
ALTER TABLE public."payment_security_audit_log" ADD CONSTRAINT "payment_security_audit_log_event_key_key" UNIQUE (event_key);
ALTER TABLE public."payment_security_audit_log" ADD CONSTRAINT "payment_security_audit_log_event_type_check" CHECK ((event_type = ANY (ARRAY['verification'::text, 'dispatch'::text, 'payment_completed'::text, 'recovery_attempt'::text, 'recovery_failed'::text, 'recovery_completed'::text, 'cod_due_collected'::text])));
ALTER TABLE public."payment_security_audit_log" ADD CONSTRAINT "payment_security_audit_log_outcome_check" CHECK ((outcome = ANY (ARRAY['success'::text, 'blocked'::text, 'started'::text])));
ALTER TABLE public."payment_security_audit_log" ADD CONSTRAINT "payment_security_audit_log_pkey" PRIMARY KEY (id);
CREATE TABLE public.messenger_order_notifications(id uuid primary key default gen_random_uuid(),order_id uuid,country_code text,event_type text,phone text,unique(order_id,event_type));
CREATE TABLE public.messenger_order_status_notifications(id uuid primary key default gen_random_uuid(),order_id uuid,country_code text,event_type text,old_status text,new_status text,phone text,unique(order_id,new_status));
ALTER TABLE public.messenger_order_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messenger_order_status_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messenger_order_notifications,public.messenger_order_status_notifications FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.dispatch_verified_cashfree_order(p_order_id uuid, p_actor_id uuid, p_intent_id uuid, p_gateway_order_id text, p_total numeric, p_advance numeric, p_due numeric, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE o public.orders%ROWTYPE; i public.cashfree_payment_intents%ROWTYPE;
BEGIN
 IF coalesce(auth.jwt()->>'role','') <> 'service_role'
    AND coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' THEN
   RAISE EXCEPTION 'Service role required';
 END IF;
 IF p_actor_id IS NULL THEN RAISE EXCEPTION 'Verified admin identity required'; END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.country_code<>'IN' OR o.status<>'packed'
   OR o.final_amount IS DISTINCT FROM p_total
   OR o.payment_advance_amount IS DISTINCT FROM p_advance
   OR o.payment_due_amount IS DISTINCT FROM p_due THEN
   RETURN jsonb_build_object('success',false,'error','Verified order changed. Hold dispatch.');
 END IF;
 SELECT * INTO i FROM public.cashfree_payment_intents WHERE id=p_intent_id FOR SHARE;
 IF NOT FOUND OR i.completed_order_id IS DISTINCT FROM o.id OR i.status<>'completed' OR i.currency<>'INR' OR i.country_code<>'IN' OR i.cashfree_order_id IS DISTINCT FROM p_gateway_order_id
    OR (SELECT count(*) FROM public.cashfree_payment_intents WHERE completed_order_id=o.id AND status='completed')<>1
    OR i.amount IS NULL OR i.amount::text IN ('NaN','Infinity','-Infinity') OR i.amount<=0
    OR o.final_amount IS NULL OR o.final_amount::text IN ('NaN','Infinity','-Infinity') OR o.final_amount<=0
    OR (i.metadata->>'payment_method'='cod' AND (p_advance IS NULL OR p_due IS NULL OR p_advance::text IN ('NaN','Infinity','-Infinity') OR p_due::text IN ('NaN','Infinity','-Infinity') OR o.payment_method<>'cod' OR p_due<0 OR abs(p_advance+p_due-p_total)>0.01 OR abs(i.amount-p_advance)>0.01))
    OR (coalesce(i.metadata->>'payment_method','')<>'cod' AND (p_due<>0 OR abs(i.amount-p_total)>0.01)) THEN
   RETURN jsonb_build_object('success',false,'error','Verified payment changed. Hold dispatch.');
 END IF;
 -- The existing dispatch guard checks the fresh timestamp and trusted request role too.
 PERFORM set_config('request.jwt.claim.role','service_role',true);
 UPDATE public.orders SET status='shipped',internal_notes=left(coalesce(p_note,''),2000),cashfree_dispatch_verified_at=clock_timestamp() WHERE id=o.id;
 INSERT INTO public.payment_security_audit_log(country_code,order_id,payment_intent_id,actor_type,actor_id,event_type,outcome,details)
 VALUES('IN',o.id,i.id,'admin',p_actor_id,'dispatch','success',jsonb_build_object('from_status',o.status,'to_status','shipped','total_amount',p_total,'advance_amount',p_advance,'due_amount',p_due,'currency','INR'));
 RETURN jsonb_build_object('success',true,'id',o.id,'status','shipped');
END;
$function$
;
CREATE OR REPLACE FUNCTION public.enqueue_messenger_order_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if coalesce(new.order_source, '') <> 'facebook_messenger_ai' then
    return new;
  end if;

  if lower(coalesce(new.order_status, new.status, '')) in ('cancelled', 'rejected') then
    return new;
  end if;

  if new.country_code = 'IN'
     and lower(coalesce(new.payment_status, '')) not in ('paid', 'partially_paid') then
    return new;
  end if;

  if trim(coalesce(new.customer_phone, '')) = '' then
    return new;
  end if;

  insert into public.messenger_order_notifications (
    order_id,
    country_code,
    event_type,
    phone
  )
  values (
    new.id,
    new.country_code,
    'order_confirmed',
    trim(coalesce(new.customer_phone, ''))
  )
  on conflict (order_id, event_type) do nothing;

  return new;
exception
  when others then
    raise warning 'Messenger order notification enqueue failed for order %: %', new.id, sqlerrm;
    return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.enqueue_messenger_order_status_notification()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  old_effective text;
  new_effective text;
begin
  if coalesce(new.order_source, '') <> 'facebook_messenger_ai' then
    return new;
  end if;

  old_effective := lower(trim(coalesce(old.order_status, old.status, '')));
  new_effective := lower(trim(coalesce(new.order_status, new.status, '')));

  if new_effective = '' or new_effective = old_effective then
    return new;
  end if;

  if new_effective not in (
    'pending',
    'processing',
    'packed',
    'shipped',
    'delivered',
    'cancelled',
    'rejected'
  ) then
    return new;
  end if;

  if trim(coalesce(new.customer_phone, '')) = '' then
    return new;
  end if;

  insert into public.messenger_order_status_notifications (
    order_id,
    country_code,
    event_type,
    old_status,
    new_status,
    phone
  )
  values (
    new.id,
    new.country_code,
    'order_status_changed',
    nullif(old_effective, ''),
    new_effective,
    trim(new.customer_phone)
  )
  on conflict (order_id, new_status) do nothing;

  return new;
exception
  when others then
    raise warning 'Messenger order status notification enqueue failed for order %: %', new.id, sqlerrm;
    return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_cashfree_verified_dispatch()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Prevent changing an India Cashfree order into another branch to bypass shipment controls.
  IF upper(coalesce(OLD.country_code, '')) = 'IN'
    AND NEW.country_code IS DISTINCT FROM OLD.country_code
    AND (
      lower(coalesce(OLD.payment_method, '')) IN ('cashfree', 'online')
      OR lower(coalesce(OLD.payment_status, '')) IN ('paid', 'partially_paid')
      OR coalesce(OLD.payment_advance_amount, 0) > 0
      OR EXISTS (SELECT 1 FROM public.cashfree_payment_intents i WHERE i.completed_order_id = OLD.id)
    )
    AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
  THEN
    RAISE EXCEPTION 'Cannot change branch of India Cashfree-paid order';
  END IF;

  IF (upper(coalesce(NEW.country_code, '')) = 'IN'
      OR upper(coalesce(OLD.country_code, '')) = 'IN')
    AND lower(coalesce(OLD.status, '')) NOT IN ('shipped', 'delivered')
    AND lower(coalesce(NEW.status, '')) IN ('shipped', 'delivered')
    AND (
      lower(coalesce(NEW.payment_method, '')) IN ('cashfree', 'online')
      OR lower(coalesce(OLD.payment_method, '')) IN ('cashfree', 'online')
      OR lower(coalesce(NEW.payment_status, '')) IN ('paid', 'partially_paid')
      OR lower(coalesce(OLD.payment_status, '')) IN ('paid', 'partially_paid')
      OR coalesce(NEW.payment_advance_amount, 0) > 0
      OR coalesce(OLD.payment_advance_amount, 0) > 0
      OR EXISTS (
        SELECT 1 FROM public.cashfree_payment_intents i
        WHERE i.completed_order_id = NEW.id
      )
    )
  THEN
    IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
       OR NEW.cashfree_dispatch_verified_at IS NULL
       OR NEW.cashfree_dispatch_verified_at < now() - interval '5 minutes'
       OR NOT EXISTS (
          SELECT 1 FROM public.cashfree_payment_intents i
          WHERE i.completed_order_id = NEW.id
            AND i.status = 'completed'
            AND upper(i.currency) = 'INR'
       )
    THEN
      RAISE EXCEPTION 'India paid orders require fresh verified Cashfree payment before dispatch'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.guard_cod_advance_financial_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.sync_order_status_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.order_status IS NOT DISTINCT FROM OLD.order_status THEN
    NEW.order_status := NEW.status;
  ELSIF NEW.order_status IS DISTINCT FROM OLD.order_status AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    NEW.status := NEW.order_status;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.validate_order_status_transition()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  old_status text := lower(coalesce(old.status,'pending'));
  new_status text := lower(coalesce(new.status,'pending'));
  allowed boolean := false;
begin
  if old_status = new_status then
    return new;
  end if;

  -- Non-authenticated/server-side maintenance paths are not restricted here.
  -- Browser/admin status changes run with auth.uid() present.
  if auth.uid() is null then
    return new;
  end if;

  allowed := case old_status
    when 'pending' then new_status in ('confirmed','cancelled')
    when 'confirmed' then new_status in ('processing','cancelled')
    when 'processing' then new_status in ('packed','cancelled')
    when 'packed' then new_status in ('shipped','cancelled')
    when 'shipped' then new_status in ('delivered','returned','cancelled')
    when 'delivered' then new_status = 'returned'
    when 'cancelled' then false
    when 'returned' then false
    else false
  end;

  if not allowed then
    raise exception 'Invalid order status transition: % -> %', old_status, new_status
      using errcode = '22023';
  end if;

  return new;
end;
$function$
;
CREATE TRIGGER trg_sync_order_status_fields BEFORE UPDATE OF status,order_status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.sync_order_status_fields();
CREATE TRIGGER za_validate_order_status_transition BEFORE UPDATE OF status,order_status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.validate_order_status_transition();
CREATE TRIGGER guard_cod_advance_financial_fields BEFORE UPDATE OF payment_advance_amount,payment_due_amount,final_amount,grand_total,total_amount,payment_status,payment_method ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_cod_advance_financial_fields();
CREATE TRIGGER trg_enqueue_messenger_order_confirmation AFTER INSERT OR UPDATE OF order_status,status,payment_status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_messenger_order_confirmation();
CREATE TRIGGER trg_enqueue_messenger_order_status_notification AFTER UPDATE OF order_status,status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.enqueue_messenger_order_status_notification();
CREATE TRIGGER zzz_guard_cashfree_verified_dispatch BEFORE UPDATE OF status,order_status,country_code ON public.orders FOR EACH ROW EXECUTE FUNCTION public.guard_cashfree_verified_dispatch();


-- Trigger helpers are not public RPCs. Trigger invocation does not need caller EXECUTE.
REVOKE EXECUTE ON FUNCTION public.enqueue_messenger_order_confirmation(),public.enqueue_messenger_order_status_notification(),public.sync_order_status_fields() FROM PUBLIC,anon,authenticated;
