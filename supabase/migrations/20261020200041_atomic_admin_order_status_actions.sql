-- Additive status-only API. Existing Cashfree dispatch RPC and notification triggers stay unchanged.
CREATE TABLE public.order_status_action_audit (
 history_id uuid PRIMARY KEY REFERENCES public.order_status_history(id),
 order_id uuid NOT NULL,
 country_code text NOT NULL CHECK(country_code IN ('IN','BD')),
 previous_status text NOT NULL,
 new_status text NOT NULL,
 actor_id uuid NOT NULL,
 actor_label text NOT NULL,
 source text NOT NULL CHECK(source='admin_manual'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX order_status_action_audit_order_idx ON public.order_status_action_audit(order_id,created_at DESC);
ALTER TABLE public.order_status_action_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_status_action_audit FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.order_status_action_audit TO authenticated;
CREATE POLICY status_action_audit_admin_read ON public.order_status_action_audit FOR SELECT TO authenticated
 USING (public.is_admin() IS TRUE AND public.can_access_country(country_code) IS TRUE);

CREATE FUNCTION public.admin_transition_order_status(
 p_order_id uuid,p_expected_status text,p_status text,p_note text DEFAULT '',
 p_confirmed boolean DEFAULT false,p_expected_country text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.admin_users%ROWTYPE; o public.orders%ROWTYPE; branch text; old_status text;
 note text:=btrim(coalesce(p_note,'')); allowed boolean; history uuid;
BEGIN
 IF auth.uid() IS NULL THEN RETURN jsonb_build_object('success',false,'code','admin_required'); END IF;
 SELECT * INTO a FROM public.admin_users WHERE user_id=auth.uid() AND is_active FOR SHARE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'code','admin_required'); END IF;
 branch:=a.country_code;
 IF a.role='master_admin' THEN
  SELECT country_code INTO branch FROM public.admin_branch_context WHERE user_id=a.user_id FOR SHARE;
 END IF;
 IF branch IS NULL OR branch NOT IN ('IN','BD') OR p_expected_country IS DISTINCT FROM branch THEN
  RETURN jsonb_build_object('success',false,'code','branch_changed'); END IF;
 SELECT * INTO o FROM public.orders WHERE id=p_order_id AND country_code=branch FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('success',false,'code','order_unavailable'); END IF;
 old_status:=o.status;
 IF p_status=old_status THEN
  RETURN jsonb_build_object('success',true,'already_updated',true,'status',old_status); END IF;
 IF p_expected_status IS DISTINCT FROM old_status THEN
  RETURN jsonb_build_object('success',false,'code','stale_order'); END IF;
 allowed:=CASE old_status
  WHEN 'pending' THEN p_status IN ('confirmed','cancelled')
  WHEN 'confirmed' THEN p_status IN ('processing','cancelled')
  WHEN 'processing' THEN p_status IN ('packed','cancelled')
  WHEN 'packed' THEN p_status IN ('shipped','cancelled')
  WHEN 'shipped' THEN p_status IN ('delivered','returned')
  WHEN 'delivered' THEN p_status='returned' ELSE false END;
 IF allowed IS NOT TRUE THEN RETURN jsonb_build_object('success',false,'code','invalid_transition'); END IF;
 IF char_length(note)>2000 OR (p_status IN ('cancelled','returned','delivered') AND char_length(note)<3) THEN
  RETURN jsonb_build_object('success',false,'code','reason_required'); END IF;
 IF p_status IN ('packed','shipped','delivered','returned') AND p_confirmed IS NOT TRUE THEN
  RETURN jsonb_build_object('success',false,'code','confirmation_required'); END IF;
 -- Do not replace or bypass the existing server-verified India dispatch path.
 IF branch='IN' AND p_status='shipped' AND (
  lower(coalesce(o.payment_method,'')) IN ('cashfree','online')
  OR lower(coalesce(o.payment_status,'')) IN ('paid','partially_paid') OR o.payment_advance_amount>0
  OR EXISTS(SELECT 1 FROM public.cashfree_payment_intents WHERE completed_order_id=o.id)
 ) THEN RETURN jsonb_build_object('success',false,'code','verified_dispatch_required'); END IF;
 UPDATE public.orders SET status=p_status,order_status=p_status,
  internal_notes=CASE WHEN note='' THEN o.internal_notes ELSE concat_ws(E'\n',nullif(o.internal_notes,''),note) END
 WHERE id=o.id;
 INSERT INTO public.order_status_history(order_id,status,note,created_at)
 VALUES(o.id,p_status,note,clock_timestamp()) RETURNING id INTO history;
 IF history IS NULL THEN RAISE EXCEPTION 'Status history could not be recorded'; END IF;
 INSERT INTO public.order_status_action_audit(history_id,order_id,country_code,previous_status,new_status,actor_id,actor_label,source)
 VALUES(history,o.id,branch,old_status,p_status,a.user_id,
 coalesce(nullif(a.full_name,''),nullif(a.name,''),nullif(a.email,''),'Admin'),'admin_manual');
 RETURN jsonb_build_object('success',true,'already_updated',false,'status',p_status,'history_id',history);
EXCEPTION WHEN OTHERS THEN
 -- PL/pgSQL subtransaction rolls back status, history, audit and queued notifications together.
 RETURN jsonb_build_object('success',false,'code','status_update_failed');
END $$;
REVOKE ALL ON FUNCTION public.admin_transition_order_status(uuid,text,text,text,boolean,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.admin_transition_order_status(uuid,text,text,text,boolean,text) TO authenticated;

CREATE FUNCTION public.get_admin_order_status_timeline(p_order_id uuid)
RETURNS TABLE(id uuid,status text,note text,created_at timestamptz,previous_status text,actor_label text,source text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_admin() IS NOT TRUE THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.orders o WHERE o.id=p_order_id AND public.can_access_country(o.country_code) IS TRUE) THEN
  RAISE EXCEPTION 'Order unavailable in current branch' USING ERRCODE='42501'; END IF;
 RETURN QUERY SELECT h.id,h.status,h.note,h.created_at,
  coalesce(a.previous_status,p.details->>'from_status'),
  coalesce(a.actor_label,CASE WHEN p.actor_id IS NOT NULL THEN coalesce(nullif(u.full_name,''),nullif(u.name,''),'Admin') ELSE NULL END),
  CASE WHEN a.history_id IS NOT NULL THEN a.source WHEN p.actor_id IS NOT NULL THEN 'verified_dispatch' ELSE 'legacy' END
 FROM public.order_status_history h
 LEFT JOIN public.order_status_action_audit a ON a.history_id=h.id
 LEFT JOIN LATERAL (
  SELECT x.actor_id,x.details FROM public.payment_security_audit_log x
  WHERE h.status='shipped' AND x.order_id=h.order_id AND x.event_type='dispatch' AND x.outcome='success'
   AND x.details->>'to_status'=h.status AND abs(extract(epoch FROM (x.created_at-h.created_at)))<5
  ORDER BY x.created_at DESC LIMIT 1
 ) p ON true
 LEFT JOIN public.admin_users u ON u.user_id=p.actor_id
 WHERE h.order_id=p_order_id ORDER BY h.created_at DESC NULLS LAST,h.id DESC LIMIT 100;
END $$;
REVOKE ALL ON FUNCTION public.get_admin_order_status_timeline(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_order_status_timeline(uuid) TO authenticated;
