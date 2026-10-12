# GAZI SEED Production Runtime Log Audit — 12 October 2026

## Scope and safety

Read-only review of the Vercel project `gaziseed`, Production Supabase project `ufxsthshyebahkwbmioe`, Supabase Security/Performance Advisors, and GitHub Actions. Supabase log window reviewed: **2026-10-11 05:05 UTC through 2026-10-12 05:05 UTC** (24 hours). A separate last-30-minute check was run at approximately **2026-10-12 05:27 UTC**.

No Production SQL, migration, data, environment variable, or deployment was changed during the log review. No secret values or customer/order values are included here.

## Executive summary

The production site alias `www.gaziseed.com` currently points to a READY Production deployment on `main` (commit `40d0abceb729`, merged PR #239). Vercel reported no Production runtime error records in the last 30-minute query window. Supabase edge logs did still show API-key-related HTTP 401 responses. The repeated PostgREST `Warp server error` line must be interpreted cautiously: the upstream PostgREST project confirms this exact message can be a false-positive log during ordinary thread cancellation, not necessarily a failed request (https://github.com/PostgREST/postgrest/issues/4799).

The most actionable code/config mismatch is that Vercel has `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` configured for Production and Preview, but the current `main` browser/server Supabase helpers prioritize `NEXT_PUBLIC_SUPABASE_ANON_KEY` and then a hard-coded fallback. The publishable-key environment variable is ignored by those helpers. This is a strong candidate for the repeated `Invalid API key` / `401` reports; it is not yet proven by an end-to-end post-deploy test.

## Findings

### 1. Supabase PostgREST timeout message — HIGH, still occurring

- In the 24-hour log window, **791** records contained `Warp server error: Thread killed by timeout manager`; 34 more appeared in the final 30-minute check, most recently at **2026-10-12 05:25:35 UTC**.
- The upstream PostgREST issue tracker states that this exact message can be a benign log during normal thread cancellation and was later changed to log only at debug level. The live database reported PostgREST 14.5, so the message count must **not** be counted as a matching number of failed user requests without corroboration.
- A snapshot of `pg_stat_activity` showed 10 idle PostgREST client connections and no long-running active application query at the exact sample time.
- `pg_stat_statements` did not reveal one obvious application query with latency large enough to explain recurring service-level errors. A high-volume query on `admin_notifications` had 7,905 calls, ~12.5 ms mean, and ~346 ms maximum in that statistics snapshot.
- The 24-hour edge status aggregation did not show 500/503 responses associated with the timeout message; the visible non-2xx requests were predominantly 401 key/auth-related responses and a handful of 400/403 responses.

**Conclusion:** classify these as **likely PostgREST log noise unless correlated to actual failed requests**, not 791 confirmed failures. No specific slow query or sustained connection saturation was found from the available snapshots. Do not blindly raise timeouts or delete indexes. If customers report failures that coincide with these timestamps, correlate edge request IDs, PostgREST logs, and query/lock waits before escalating.

### 2. Supabase Data API 401 responses — HIGH

In the 24-hour edge-log window:

| Path | Status | Count | Most recent |
|---|---:|---:|---|
| `/rest/v1/marketing_settings` | 401 | 219 | 2026-10-12 04:56:32 UTC |
| `/rest/v1/pages` | 401 | 40 | 2026-10-12 00:34:55 UTC |
| `/rest/v1/reviews` | 401 | 2 | 2026-10-11 17:23:16 UTC |
| `/rest/v1/categories` | 401 | 2 | 2026-10-12 00:05:40 UTC |
| `/auth/v1/token` | 401 | 1 | 2026-10-11 13:03:25 UTC |

The last-30-minute Supabase query still found 3 `401` requests to `marketing_settings` (latest **05:06:28 UTC**). This is not simply a stale, pre-deployment log cluster.

**Likely root cause to fix and verify:** the current app helpers do not read the configured `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` first. A reviewed change on PR #246 now prefers that configured value in browser, server, and product API code, falling back to compatible legacy key names only if needed. This needs a successful preview plus live non-sensitive read checks before declaring the 401 issue resolved.

### 3. Supabase Auth 400 responses — mostly session/input errors, not yet evidence of a platform outage

There were 8 `400` responses to `/auth/v1/token` in the 24-hour path aggregation, plus a small number of related auth events. The samples included invalid login credentials, invalid/expired refresh tokens, and a PKCE verifier mismatch; one email verification link was expired. These commonly indicate bad credentials or a stale browser session. They should be treated separately from the Data API's repeated 401s unless a reproducible login problem is reported.

### 4. Referral wallet summary 403 — known, narrow permission mismatch

One `403` was observed on `/rest/v1/rpc/get_referral_wallet_summary` (2026-10-11 13:06 UTC). This matches the previously reviewed checkout RPC permission issue tracked in PR #244, which adds a self-scoped RPC instead of having the client call the privileged parameterized helper. That PR has not been confirmed merged/deployed in this audit.

### 5. Vercel runtime error clusters — some historical, one key issue overlaps the current backend symptom

The 7-day grouped runtime error report included:
- **213** cookie-write errors (latest 2026-10-08);
- **125** runtime timeouts (latest 2026-10-08);
- **24** `AuthApiError: Invalid API key` errors (latest 2026-10-11 13:03 UTC);
- **3** network `ETIMEDOUT` / closed-socket errors (latest 2026-10-11 14:44 UTC).

The cookie and timeout clusters were last observed on an older deployment, before the current Production `main` deployment, and were not present in the last-24-hour Vercel grouped error response. The key/API errors overlap the Supabase 401 symptom and deserve priority. Vercel's raw runtime-log query returned no entries matching error/fatal in the last 30 minutes.

### 6. Supabase Security Advisor — warnings to review, not all confirmed vulnerabilities

The current Security Advisor reported:
- Four tables with RLS enabled but no policies: `cashfree_campaign_payment_rate_limits`, `cashfree_recovery_settings`, `meta_ads_insights_daily`, and `meta_capi_events`. This may be intentional for service-role-only tables; confirm grants before adding public policies.
- Six anonymous-executable `SECURITY DEFINER` functions, including public checkout/offer-order functions and `track_order`. These may be intentional storefront entry points; inspect function bodies, rate limiting and grants rather than revoking them blindly.
- Eleven authenticated-executable `SECURITY DEFINER` functions, including admin/branch helpers. Validate each against intended callers and internal authorization.
- Leaked-password protection is disabled in Supabase Auth.

The Performance Advisor listed 31 unused indexes. An unused-index notice alone does not justify dropping an index, especially for rare administrative or recovery flows.

### 7. Private-column and Storage findings already tracked separately

The earlier read-only catalog audit identified public-role column SELECT permissions on `products.cost_price` and `reviews.guest_phone`, plus Storage write policies scoped by bucket ID rather than admin role. These are being handled in Draft PR #246. Its initial Build check caught that the public review projection omitted `user_id` while the shared TypeScript `Review` type required it. The type was corrected to reflect the privacy-preserving projection; **latest GitHub Build Verification and ESLint checks both pass** on commit `70252648b3`. The latest Vercel Preview deployment for that exact commit still needs confirmation.

## Work currently in progress

1. **Publishable-key resolution:** added to Draft PR #246 in `lib/supabase/client.ts`, `lib/supabase/server.ts`, and `app/api/products/route.ts`. Still requires a Vercel preview/runtime check and confirmation that the `marketing_settings` 401s stop.
2. **Private product/review fields and admin-only Storage writes:** Draft PR #246 includes application/migration/test changes. Do not merge or apply its migration until its preview, cost-field round trip, public review rendering, and Storage authorization checks pass in the intended test environment.
3. **Referral wallet 403:** PR #244's self-scoped RPC fix needs merge/deployment status verification and an authenticated checkout regression.
4. **PostgREST timeout cluster:** unresolved. A specific route/query has not yet been tied to these service-level timeout records; avoid claiming a root cause until edge/Postgres correlation exists.

## Production change boundary

This document is evidence from log/metadata queries only. No Production schema, data, Auth setting, environment variable, Storage policy, deployment alias, or migration history was changed. Historical migration files must not be replayed as a shortcut to fixing these symptoms.
