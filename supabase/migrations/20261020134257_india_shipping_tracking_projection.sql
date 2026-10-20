-- Project only trusted, ordered shipment tracking; never change order/payment/pickup state.
CREATE FUNCTION public.project_india_shipping_tracking() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.event_occurred_at IS NULL OR NEW.event_occurred_at>clock_timestamp()+interval '5 minutes'
 OR NEW.event_occurred_at<'2000-01-01'::timestamptz THEN RETURN NEW; END IF;
 UPDATE public.india_shipping_shipments s
 SET tracking_status=NEW.event_status,tracking_occurred_at=NEW.event_occurred_at,updated_at=clock_timestamp()
 WHERE s.id=NEW.shipment_id AND s.country_code='IN'
 AND NEW.event_status IS NOT NULL AND length(trim(NEW.event_status)) BETWEEN 1 AND 100
 AND (s.tracking_occurred_at IS NULL OR NEW.event_occurred_at>s.tracking_occurred_at)
 AND (lower(trim(coalesce(s.tracking_status,''))) NOT IN ('delivered','rto delivered','cancelled','lost','damaged','disposed')
      OR lower(trim(s.tracking_status))=lower(trim(NEW.event_status)));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.project_india_shipping_tracking() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER project_india_shipping_tracking AFTER INSERT ON public.india_shipping_webhook_events
FOR EACH ROW EXECUTE FUNCTION public.project_india_shipping_tracking();
