-- Restrict legacy/internal order RPCs from direct public/anonymous execution.
-- These functions remain callable by server-side SECURITY DEFINER wrappers
-- and service-role workflows:
--   create_order(13-argument offer wrapper)
--   ai_create_product_order -> create_order(9-argument internal website order)
--   ai_create_offer_order -> create_offer_order
--
-- Current browser entrypoints do not call these two functions directly.
-- Keep service_role execution intact.

REVOKE EXECUTE ON FUNCTION public.create_offer_order(
  uuid,
  uuid,
  integer,
  uuid,
  text,
  text,
  text,
  uuid,
  text,
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.create_order(
  text,
  text,
  text,
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
) FROM PUBLIC, anon;
