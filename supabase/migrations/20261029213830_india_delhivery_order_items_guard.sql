-- Lock order line items while a Delhivery manifest is pending, active, or uncertain.
CREATE OR REPLACE FUNCTION public.guard_india_delhivery_order_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE old_order uuid; new_order uuid;
BEGIN
  IF TG_OP<>'INSERT' THEN old_order:=OLD.order_id; END IF;
  IF TG_OP<>'DELETE' THEN new_order:=NEW.order_id; END IF;
  PERFORM 1 FROM public.orders WHERE id IN (old_order,new_order) ORDER BY id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.india_shipping_shipments
    WHERE order_id IN (old_order,new_order) AND creation_state IN ('reserved','submitting','awb_assigned','reconcile_required')) THEN
    RAISE EXCEPTION 'Order items are locked by a Delhivery shipment; reconcile before editing' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_india_delhivery_order_items() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS guard_india_delhivery_order_items_trigger ON public.order_items;
CREATE TRIGGER guard_india_delhivery_order_items_trigger BEFORE INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.guard_india_delhivery_order_items();
