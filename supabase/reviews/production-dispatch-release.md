# India Cashfree dispatch evidence: release record

Status (2026-10-20): Sandbox verified. Production writer credential configured by the owner, read-only readiness checks passed, paired API v8 and activation migration deployed. Admin UI release follows through PR #277. This supersedes earlier blocked/prototype status.

The API independently checks Cashfree order, successful payment and refunds before recording short-lived evidence through a dedicated database login. Only the service-role dispatch RPC can consume that evidence, after checking the stored active India admin and financial snapshot. Shipping, history and audit commit atomically. Immutable subject registration prevents method/status or intent-link downgrades from escaping the guard. Bangladesh paths are preserved.

## Validation

- 33 dispatch + 19 signed webhook + 22 recovery mocked scenarios pass; TypeScript check passes.
- 29 transactional SQL scenarios on Sandbox public-table shapes pass, including tampering, replay, stale/refunded evidence, actor/branch checks, rollback on audit failure, COD/prepaid, cached-client history deduplication and notification uniqueness.
- Actual Admin Order component in the existing Vercel Sandbox preview: provider verification and shipped update pass against the real public-schema API with the dedicated writer principal. Readback: one history, one Messenger queue event, one dispatch audit, consumed evidence, zero remaining authorization markers.
- Refunded Sandbox order is blocked and remains packed. Existing paid Sandbox payment was reused; no live charge/refund or Messenger send occurred.
- Rollback rehearsal restores the original RPC/guard fingerprints inside a rolled-back transaction.
- Preview is a component harness with a Sandbox data adapter, not the full Production Next.js Admin shell. Full Production smoke remains a deployment task.
- Security Advisor: private/fixture RLS tables intentionally have no client policies. Sandbox auth helpers intentionally allow authenticated execution; leaked-password protection is an existing project setting. Copied trigger helpers had public EXECUTE revoked. No blanket security-clean claim.

## Coordinated release

Do not run an indiscriminate `db push`: activation is deliberately separated from preparation.

1. Hold India Cashfree dispatch during the coordinated change; confirm backup and current function fingerprints match the activation preflight. Apply only `20261020030558_dispatch_evidence_prepare.sql` to Production `ufxsthshyebahkwbmioe`.
2. Provision a new Production-only LOGIN with NOINHERIT, NOSUPERUSER, NOCREATEDB, NOCREATEROLE, NOREPLICATION and NOBYPASSRLS; grant membership in `cashfree_evidence_writer`. Set its strong password through a secure interface. Never reuse the Sandbox login/password and never commit or paste the URL into chat.
3. Save its correctly URL-encoded, project-scoped database URL as Edge Secret `CASHFREE_DISPATCH_WRITER_DATABASE_URL`. Use the project's actual pooler hostname and explicit port. Retain existing live Cashfree keys. This secret is server-only, never NEXT_PUBLIC or Vercel browser configuration. The handler uses SET LOCAL ROLE for NOINHERIT membership.
4. While dispatch is held, deploy the paired `cashfree-verify-dispatch` function (JWT verification enabled) and apply only `20261020030612_dispatch_evidence_activate.sql`. Deploy the Admin page update from this PR. The handler/guard must change together; mismatched versions fail closed or retain the old guard and are not an acceptable steady state.
5. Check a controlled India order with verify-only, then one explicitly selected eligible dispatch; verify atomic history/audit and exactly one queue entry. Verify Bangladesh still uses its existing path. Resume dispatch only after checks pass. Do not create test live charges or send real Messenger test messages.

Update 2026-10-20: Production preparation migration was applied and verified. The dedicated principal cashfree_dispatch_writer exists as NOLOGIN/NOINHERIT, with only cashfree_evidence_writer membership and no direct order/evidence writes. Password and Edge Secret are not configured. The active dispatch guard fingerprint remains unchanged; activation and API/UI rollout have not been performed. PR #276 and checkout/Shiprocket configuration were not changed.

## Rollback

Keep dispatch held. Redeploy the previous Edge function version and execute `dispatch_evidence_activation_rollback.sql` as a coordinated pair; deploy the previous Admin UI if required. Check the old function fingerprints and original trigger shape before resuming. The rollback deliberately retains private evidence and consumed records for investigation, but removes new guard/history/subject trigger wiring. Do not delete evidence or replay payments automatically. The old dispatch model has weaker protections, so investigate the failed rollout before another activation.

## Sandbox reproduction

Use only `qqehtphbpypcmxliaiqd`. `production_port_sandbox_fixture_schema.sql` is a metadata-only fixture baseline; never run it in Production. The Sandbox adapter source is `sandbox-admin-dispatch-preview.ts.txt`. Enroll an existing synthetic auth user as an active India admin and implement the is_admin/current_admin_country auth helpers against auth.uid and stored admin context; do not grant direct client access to fixture tables. Apply prepare/activate, grant the existing Sandbox writer group membership, and run `supabase/tests/dispatch_evidence_public_port.sql` (always ends in rollback). The fixture contains no customer export or webhook credentials.

## Production deployment evidence — 2026-10-20

The owner configured a new password and CASHFREE_DISPATCH_WRITER_DATABASE_URL directly in Supabase. No credential value was read or committed. The read-only authenticated readiness probe returned HTTP 200 with database_connection, writer_identity, writer_rpc and cashfree_credentials_valid all true; Cashfree returned order_not_found (404) for a deliberately nonexistent order. No payment operation or order update was performed.

The main cashfree-verify-dispatch function deployed as v8 with JWT verification enabled. Activation applied successfully; guard fingerprint is 8ca48b048f66a67385cf0e1c924e8b77. The zzz_guard_cashfree_verified_dispatch trigger is enabled on all order updates; subject registration is enabled. Client direct dispatch, writer order UPDATE and service-role evidence INSERT remain denied, with zero pending markers. Owner direct RPC invocation was denied in a rolled-back read-only negative test.

Production Admin navigation redirected to the storefront because the browser has no active admin session. Therefore no authenticated verify-only smoke or real-order dispatch was performed in Production. These remain explicitly unverified; Sandbox real-component E2E is the evidence for shipping behavior. Do not mark a real order shipped merely to test deployment.
