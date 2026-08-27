-- Remove the legacy Delivery Zone-based offer order RPC.
-- Current storefront flows use the secure no-zone offer bridge and the normal
-- checkout create_order overload; Combo uses create_combo_order().
-- This reduces the public RPC surface without changing order data.

DROP FUNCTION IF EXISTS public.create_order(
  text,
  text,
  text,
  uuid,
  text,
  text,
  jsonb,
  text,
  text,
  text,
  text,
  text,
  text,
  text
);
