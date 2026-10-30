-- Keep Delhivery eligibility aligned with the order's server-verified payment
-- ledger. Full COD and COD-with-advance orders both carry an unpaid courier
-- balance; prepaid Cashfree orders have no balance due at delivery.
CREATE OR REPLACE FUNCTION public.india_delhivery_booking_snapshot(p_order uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'order', to_jsonb(o),
    'parcel', to_jsonb(p),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'product_name', oi.product_name, 'quantity', oi.quantity, 'total_price', oi.total_price
    ) ORDER BY oi.id) FROM public.order_items oi WHERE oi.order_id=o.id), '[]'::jsonb)
  )
  FROM public.orders o
  JOIN public.india_shipping_preparations p ON p.order_id=o.id AND p.country_code='IN'
  WHERE o.id=p_order AND o.country_code='IN' AND o.status='packed'
    AND nullif(trim(o.customer_name),'') IS NOT NULL
    AND regexp_replace(coalesce(o.customer_phone,''),'[^0-9]','','g') ~ '^[0-9]{10,12}$'
    AND nullif(trim(o.delivery_address),'') IS NOT NULL
    AND coalesce(o.final_amount,o.grand_total,0)>0
    AND (
      (lower(coalesce(o.payment_method,''))='cashfree'
        AND lower(coalesce(o.payment_status,''))='paid'
        AND coalesce(o.payment_advance_amount,0)=0
        AND coalesce(o.payment_due_amount,0)=0)
      OR
      (lower(coalesce(o.payment_method,''))='cod'
        AND lower(coalesce(o.payment_status,'')) IN ('unpaid','partially_paid')
        AND coalesce(o.payment_due_amount,0)>0
        AND coalesce(o.payment_advance_amount,0)>=0
        AND (lower(coalesce(o.payment_status,''))<>'unpaid' OR coalesce(o.payment_advance_amount,0)=0)
        AND (lower(coalesce(o.payment_status,''))<>'partially_paid' OR coalesce(o.payment_advance_amount,0)>0)
        AND abs(coalesce(o.payment_advance_amount,0)+o.payment_due_amount-coalesce(o.final_amount,o.grand_total))<0.01)
    )
    AND p.delivery_pin ~ '^[1-9][0-9]{5}$'
    AND p.weight_kg BETWEEN 0.01 AND 100
    AND p.length_cm BETWEEN 1 AND 200 AND p.breadth_cm BETWEEN 1 AND 200 AND p.height_cm BETWEEN 1 AND 200
    AND EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id=o.id AND oi.quantity>0)
$$;

COMMENT ON FUNCTION public.india_delhivery_booking_snapshot(uuid) IS
  'India-admin service-role snapshot. Allows fully paid Cashfree orders and ledger-balanced full or advance COD orders; COD must have a positive due balance that equals the stored order balance.';
