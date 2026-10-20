# Order status actions — India and Bangladesh

The Admin Orders status editor now offers permitted operations instead of an unrestricted status dropdown. Existing status codes, filters, payment summaries, COD collection, Cashfree checks, notification triggers, inventory/referral triggers and courier APIs are preserved.

## Workflow

Pending → Confirm → Start packing → Packing complete → Record courier handover → Record delivery. Cancellation is offered only before handover; shipped/delivered orders can record a received return. Cancelled/returned orders cannot restart. Packing, handover, delivery and return require an explicit physical-action confirmation. Cancellation, manual delivery and return require a reason/verification note. Handover does not book a courier or request pickup, and delivery/return do not mark payments paid or issue refunds.

The UI locks during a request and does not automatically retry. The new RPC locks the current active Admin, Master Admin branch context and order; checks expected branch/status; and commits status + synchronized order_status + history + admin audit together. Repeating the same transition returns already_updated without repeating history or notifications. Concurrent stale edits cannot overwrite a newer status. Existing internal notes are retained; new status notes are appended and displayed separately in history.

## India verified dispatch compatibility

India paid/advance shipments still call the existing `cashfree-verify-dispatch` Edge Function. That path performs its existing checks and atomically writes its own history. The new manual RPC refuses protected India dispatch; the existing database dispatch guard remains authoritative. No payment function, credential, verification timestamp, evidence writer or courier booking implementation changed.

## History

`order_status_action_audit` stores the real Admin identity, label, branch and previous/new status linked to each new manual history row. Direct client audit writes and anonymous RPC execution are denied; RLS permits only Admin reads in the authorized branch. The Admin timeline reads old history too. Verified dispatch actor/source is derived from the existing successful payment dispatch audit where it matches; records with no reliable actor remain explicitly legacy. No old actors are fabricated.

The SECURITY DEFINER RPCs are intentionally authenticated API entry points with explicit server-side Admin/branch authorization and empty search_path. The Advisor notice about authenticated SECURITY DEFINER execution is reviewed/intentional, not an unrestricted customer permission. New audit metadata is not added to customer-readable history columns.

## Validation

- 48 real Sandbox SQL assertions passed for both branches: full workflows, role/branch isolation, Master Admin context, stale actions, confirmations/reasons, terminal/invalid transitions, protected dispatch refusal, payment preservation, synchronized status, timeline, idempotency and notification deduplication.
- Forced an audit constraint failure: order, history and notification changes all rolled back.
- Two concurrent real requests produced one update and one already_updated response, with one history and one audit. Synthetic race fixtures were cleaned; rollback test fixtures left zero orders.
- Four UI policy tests, typecheck, targeted ESLint and Messenger regression passed. Existing image-optimization lint warning remains unrelated. All 15 Cashfree/COD security scenarios passed.
- Production migration `20261020200041_atomic_admin_order_status_actions` was applied after Sandbox tests, before the frontend release. It is additive. Anonymous execution/direct audit insert remain denied; a non-admin read-only probe returned admin_required. Hashes of existing Cashfree, COD, notification, status-sync and transition guard functions matched before/after.

## Boundaries and rollout

This change does not enable automatic courier delivery updates, shipping draft #266 or checkout #276. Shiprocket Sandbox ticket 8843999 remains separate. No real customer order was advanced for QA and no customer message was sent by the tests. Notification queue behavior was checked transactionally; external message delivery was not exercised.

Older cached Admin pages remain compatible with the original database update/history path. The new UI uses the atomic API. Roll back the frontend first if needed; additive RPC/audit objects can remain without affecting the old UI. Do not remove audit records or deploy any unrelated migration during rollback.
