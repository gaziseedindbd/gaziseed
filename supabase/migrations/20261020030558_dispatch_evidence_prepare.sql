-- Phase A: additive preparation only. Does not replace the active dispatch guard/RPC.
DO $role$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cashfree_evidence_writer') THEN
  CREATE ROLE cashfree_evidence_writer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cashfree_evidence_writer' AND (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls)) THEN
  RAISE EXCEPTION 'Unsafe pre-existing evidence group role';
 END IF;
END $role$;
CREATE SCHEMA cashfree_dispatch_private;
REVOKE ALL ON SCHEMA cashfree_dispatch_private FROM PUBLIC,anon,authenticated,service_role,cashfree_evidence_writer;
CREATE TABLE cashfree_dispatch_private.evidence (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id),
 intent_id uuid NOT NULL REFERENCES public.cashfree_payment_intents(id),
 provider_order_id text NOT NULL CHECK(length(provider_order_id)>0),
 provider_payment_id text NOT NULL UNIQUE CHECK(length(provider_payment_id)>0),
 amount numeric NOT NULL CHECK(amount>0 AND amount::text NOT IN ('NaN','Infinity','-Infinity')),
 currency text NOT NULL CHECK(currency='INR'),
 total_snapshot numeric NOT NULL,
 advance_snapshot numeric NOT NULL,
 due_snapshot numeric NOT NULL,
 method_snapshot text NOT NULL,
 verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 consumed_at timestamptz,
 history_id uuid,
 revoked_at timestamptz
);
CREATE TABLE cashfree_dispatch_private.subjects(order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE);
ALTER TABLE cashfree_dispatch_private.subjects ENABLE ROW LEVEL SECURITY;
INSERT INTO cashfree_dispatch_private.subjects(order_id)
SELECT o.id FROM public.orders o WHERE o.country_code='IN' AND (lower(coalesce(o.payment_method,'')) IN ('cashfree','online') OR lower(coalesce(o.payment_status,'')) IN ('paid','partially_paid') OR o.payment_advance_amount>0 OR EXISTS(SELECT 1 FROM public.cashfree_payment_intents i WHERE i.completed_order_id=o.id));
CREATE FUNCTION cashfree_dispatch_private.register_subject() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE keep boolean;
BEGIN
 keep:=NEW.country_code='IN' AND (lower(coalesce(NEW.payment_method,'')) IN ('cashfree','online') OR lower(coalesce(NEW.payment_status,'')) IN ('paid','partially_paid') OR NEW.payment_advance_amount>0 OR EXISTS(SELECT 1 FROM public.cashfree_payment_intents WHERE completed_order_id=NEW.id));
 IF TG_OP='UPDATE' THEN keep:=keep OR (OLD.country_code='IN' AND (lower(coalesce(OLD.payment_method,'')) IN ('cashfree','online') OR lower(coalesce(OLD.payment_status,'')) IN ('paid','partially_paid') OR OLD.payment_advance_amount>0)); END IF;
 IF keep THEN INSERT INTO cashfree_dispatch_private.subjects(order_id) VALUES(NEW.id) ON CONFLICT DO NOTHING; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER register_cashfree_dispatch_subject AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION cashfree_dispatch_private.register_subject();
CREATE TABLE cashfree_dispatch_private.authorizations (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id), transaction_id bigint NOT NULL
);
ALTER TABLE cashfree_dispatch_private.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashfree_dispatch_private.authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA cashfree_dispatch_private FROM PUBLIC,anon,authenticated,service_role,cashfree_evidence_writer;

CREATE FUNCTION cashfree_dispatch_private.assert_writer() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF session_user IN ('postgres','supabase_admin','authenticator','service_role','anon','authenticated')
 OR NOT pg_has_role(session_user,'cashfree_evidence_writer','MEMBER') THEN
  RAISE EXCEPTION 'Dedicated evidence writer required' USING ERRCODE='42501';
 END IF;
END $$;

CREATE FUNCTION public.get_cashfree_dispatch_identity(p_order_id uuid)
RETURNS TABLE(intent_id uuid,provider_order_id text,expected_amount numeric,currency text,total numeric,advance numeric,due numeric,method text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM cashfree_dispatch_private.assert_writer();
 RETURN QUERY SELECT i.id,i.cashfree_order_id,CASE WHEN o.payment_method='cod' THEN o.payment_advance_amount ELSE o.final_amount END,
 i.currency,o.final_amount,o.payment_advance_amount,o.payment_due_amount,o.payment_method
 FROM public.orders o JOIN public.cashfree_payment_intents i ON i.completed_order_id=o.id
 WHERE o.id=p_order_id AND o.country_code='IN' AND o.status='packed' AND i.country_code='IN' AND i.status='completed' AND i.currency='INR'
 AND (SELECT count(*) FROM public.cashfree_payment_intents x WHERE x.completed_order_id=o.id AND x.status='completed')=1;
END $$;

CREATE FUNCTION public.record_cashfree_dispatch_evidence(p_order_id uuid,p_intent_id uuid,p_provider_order_id text,p_provider_payment_id text,p_amount numeric,p_currency text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE o public.orders%ROWTYPE; i public.cashfree_payment_intents%ROWTYPE; expected numeric; cod boolean;
BEGIN
 PERFORM cashfree_dispatch_private.assert_writer();
 SELECT * INTO o FROM public.orders WHERE id=p_order_id FOR UPDATE;
 IF NOT FOUND OR o.country_code<>'IN' OR o.status<>'packed' THEN RAISE EXCEPTION 'Ineligible evidence order' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM public.cashfree_payment_intents WHERE id=p_intent_id FOR SHARE;
 cod:=o.payment_method='cod'; expected:=CASE WHEN cod THEN o.payment_advance_amount ELSE o.final_amount END;
 IF NOT FOUND OR i.completed_order_id IS DISTINCT FROM o.id OR i.country_code<>'IN' OR i.status<>'completed' OR i.currency<>'INR'
 OR i.cashfree_order_id IS DISTINCT FROM p_provider_order_id OR coalesce(p_provider_order_id,'')='' OR coalesce(p_provider_payment_id,'')=''
 OR p_currency IS DISTINCT FROM 'INR' OR p_amount IS NULL OR p_amount::text IN ('NaN','Infinity','-Infinity') OR p_amount<=0
 OR expected IS NULL OR expected::text IN ('NaN','Infinity','-Infinity') OR expected<=0
 OR i.amount::text IN ('NaN','Infinity','-Infinity') OR abs(i.amount-expected)>0.01 OR abs(p_amount-expected)>0.01
 OR o.final_amount IS NULL OR o.final_amount::text IN ('NaN','Infinity','-Infinity') OR o.final_amount<=0
 OR o.payment_advance_amount::text IN ('NaN','Infinity','-Infinity') OR o.payment_due_amount::text IN ('NaN','Infinity','-Infinity') OR o.payment_due_amount<0
 OR (cod AND (i.metadata->>'payment_method' IS DISTINCT FROM 'cod' OR o.payment_status IS DISTINCT FROM 'partially_paid' OR abs(expected+o.payment_due_amount-o.final_amount)>0.01))
 OR (NOT cod AND (coalesce(i.metadata->>'payment_method','')='cod' OR o.payment_status IS DISTINCT FROM 'paid' OR o.payment_due_amount<>0))
 OR (SELECT count(*) FROM public.cashfree_payment_intents WHERE completed_order_id=o.id AND status='completed')<>1
 THEN RAISE EXCEPTION 'Evidence identity or amount changed' USING ERRCODE='42501'; END IF;
 INSERT INTO cashfree_dispatch_private.evidence AS e(order_id,intent_id,provider_order_id,provider_payment_id,amount,currency,total_snapshot,advance_snapshot,due_snapshot,method_snapshot)
 VALUES(o.id,i.id,p_provider_order_id,p_provider_payment_id,p_amount,'INR',o.final_amount,o.payment_advance_amount,o.payment_due_amount,o.payment_method)
 ON CONFLICT(order_id) DO UPDATE SET verified_at=clock_timestamp()
 WHERE e.intent_id=excluded.intent_id AND e.provider_order_id=excluded.provider_order_id AND e.provider_payment_id=excluded.provider_payment_id
 AND e.amount=excluded.amount AND e.currency=excluded.currency AND e.total_snapshot=excluded.total_snapshot
 AND e.advance_snapshot=excluded.advance_snapshot AND e.due_snapshot=excluded.due_snapshot AND e.method_snapshot=excluded.method_snapshot
 AND e.consumed_at IS NULL AND e.revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evidence consumed, revoked or rebound' USING ERRCODE='42501'; END IF;
END $$;

CREATE FUNCTION public.revoke_cashfree_dispatch_evidence(p_order_id uuid,p_provider_order_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 PERFORM cashfree_dispatch_private.assert_writer();
 -- Same order->evidence lock ordering as record and dispatch.
 PERFORM 1 FROM public.orders WHERE id=p_order_id AND country_code='IN' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Ineligible revoke order' USING ERRCODE='42501'; END IF;
 UPDATE cashfree_dispatch_private.evidence SET revoked_at=coalesce(revoked_at,clock_timestamp())
 WHERE order_id=p_order_id AND provider_order_id=p_provider_order_id;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cashfree_dispatch_private FROM PUBLIC,anon,authenticated,service_role,cashfree_evidence_writer;
REVOKE ALL ON FUNCTION public.get_cashfree_dispatch_identity(uuid),public.record_cashfree_dispatch_evidence(uuid,uuid,text,text,numeric,text),public.revoke_cashfree_dispatch_evidence(uuid,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA public TO cashfree_evidence_writer;
GRANT EXECUTE ON FUNCTION public.get_cashfree_dispatch_identity(uuid),public.record_cashfree_dispatch_evidence(uuid,uuid,text,text,numeric,text),public.revoke_cashfree_dispatch_evidence(uuid,text) TO cashfree_evidence_writer;
-- Provision a separate, nonprivileged LOGIN principal and grant ONLY this group.
-- This migration intentionally creates no password and grants no direct table access.
