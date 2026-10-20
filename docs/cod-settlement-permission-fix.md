# India COD settlement permission repair

The Orders page calls `public.collect_cod_due_atomic(uuid)` as `authenticated`. Production had only postgres/service_role EXECUTE, so even a Master Admin was rejected before the existing function's authorization checks ran. Migration history identifies `20260921060140_harden_order_user_binding_and_rpc_privileges` as revoking browser access; later function replacements preserved that ACL.

## Change applied

`20261020192700_restore_guarded_cod_due_collection_execute` restores EXECUTE on this one signature to authenticated and explicitly keeps PUBLIC/anon denied. It first checks the exact reviewed function definition hash (`12da1672d2ed75ec1d577f1e5389b313`), SECURITY DEFINER and postgres ownership; an unexpected definition aborts the migration. It does not replace the function or change table permissions, orders, amounts, triggers, RLS or payment records.

Applied first to Sandbox `qqehtphbpypcmxliaiqd`, then Production `ufxsthshyebahkwbmioe`, with user authorization. Production definition hash remained unchanged after the fix. No Vercel deployment is needed for this database permission change.

## Verification

The Sandbox lacked the settlement RPC, country-access helper and admin audit table. Those were provisioned as Sandbox-only compatibility scaffolding using the Production RPC/helper definitions and audit columns; they are not part of the Production permission migration. The existing financial guard matches Production. The production RPC definition hash matched exactly before testing.

`supabase/tests/cod-settlement-permissions.sql` exercised the real public RPC as `authenticated`, against synthetic public-schema fixtures and the real auth helpers/financial triggers. All 18 assertions passed, and the entire fixture transaction rolled back:

- India Admin and India-context Master Admin settle delivered COD (total 400, advance 100, due 300).
- Anonymous EXECUTE is denied; customers and inactive admins are rejected.
- Bangladesh Admin cannot settle India, and India Admin cannot settle Bangladesh.
- Packed/undelivered, prepaid, invalid amount and missing orders are blocked.
- Repeated collection is idempotent; exactly one admin audit and one payment audit record exist for the collection.
- Amount/status readback matches; rejected orders and their audits remain unchanged.

After rollback, zero `COD-AUDIT-*` orders remained in Sandbox. Production read-only authorization probes also passed: an ordinary synthetic authenticated identity was rejected with `Admin access required`; a current active India admin executing the RPC with a NULL order ID reached `Order not found` rather than permission denial. NULL cannot match the non-null order primary key; no order/audit/payment mutation occurred.

## Boundaries

No actual customer's COD balance was collected or marked Paid. Browser collection of a real order remains a user action after confirming receipt of the money. This button records a collection; it does not charge a customer or verify Shiprocket remittance. Shiprocket Sandbox access/support ticket 8843999, shipping draft #266, Bangladesh, Messenger, and #276 were not changed by this repair.

Rollback, if required: revoke EXECUTE on `public.collect_cod_due_atomic(uuid)` from authenticated. That restores the previous blocked button behavior; it does not reverse recorded legitimate collections.
