-- India-only delivery policy: below INR 500 = INR 99; INR 500+ = free.
-- Preserve existing rules for Bangladesh and existing historical orders.
DO $$
BEGIN
  IF (SELECT count(*) FROM public.delivery_charge_rules WHERE country_code = 'IN' AND is_active) <> 4
     OR NOT EXISTS (SELECT 1 FROM public.delivery_charge_rules WHERE id = 'dceaa61e-e808-4ea8-a241-b283373b5f1b' AND country_code='IN' AND min_order=0 AND max_order=299 AND charge=199)
     OR NOT EXISTS (SELECT 1 FROM public.delivery_charge_rules WHERE id = 'cb3ed7b4-5f2e-44f0-9f5f-2c68795b55aa' AND country_code='IN' AND min_order=1000 AND max_order IS NULL AND charge=0)
  THEN
    RAISE EXCEPTION 'India delivery rules changed; abort for manual reconciliation';
  END IF;

  UPDATE public.delivery_charge_rules
  SET max_order = 499.99, charge = 99, is_free = false,
      title = 'Orders below ₹500', subtitle = 'Fixed ₹99 delivery charge',
      display_order = 1, updated_at = now()
  WHERE id = 'dceaa61e-e808-4ea8-a241-b283373b5f1b' AND country_code = 'IN';

  UPDATE public.delivery_charge_rules
  SET min_order = 500, max_order = NULL, charge = 0, is_free = true,
      title = 'Orders ₹500 and above', subtitle = 'FREE delivery',
      display_order = 2, updated_at = now()
  WHERE id = 'cb3ed7b4-5f2e-44f0-9f5f-2c68795b55aa' AND country_code = 'IN';

  UPDATE public.delivery_charge_rules
  SET is_active = false, updated_at = now()
  WHERE country_code = 'IN'
    AND id IN ('2d8838a8-1f9e-425d-a92a-133827255393', '7764222c-d4a8-4851-8b4f-f1cb772c9ca1');
END $$;

DO $$
BEGIN
 IF (SELECT count(*) FROM public.delivery_charge_rules WHERE country_code='IN' AND is_active) <> 2
    OR NOT EXISTS (SELECT 1 FROM public.delivery_charge_rules WHERE country_code='IN' AND is_active AND min_order=0 AND max_order=499.99 AND charge=99)
    OR NOT EXISTS (SELECT 1 FROM public.delivery_charge_rules WHERE country_code='IN' AND is_active AND min_order=500 AND max_order IS NULL AND charge=0 AND is_free)
 THEN RAISE EXCEPTION 'India delivery policy verification failed'; END IF;
END $$;
