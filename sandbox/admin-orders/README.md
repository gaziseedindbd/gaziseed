# Real Admin Orders component, isolated Sandbox Preview

This compiles the actual `app/admin/orders/page.tsx`, its real payment summary and payment audit components, and the existing Tailwind theme. It does not copy or reconstruct the Order UI. Esbuild replaces only the Supabase client module with the explicit Sandbox adapter and Next's search-parameter hook with a browser equivalent.

This is component-level integration, not the entire Next.js Admin shell/auth stack. Login is the confirmed gaziseed-test Auth user and active India membership is independently checked server-side. Tokens exist in browser memory only. The banner explicitly marks synthetic display details and empty order items. Payment audit rows are derived from actual Sandbox provider evidence. Original-page history inserts persist to private `security_compat.order_status_history` after a consumed-evidence dispatch.

Verify and shipped buttons call the deployed Sandbox `cashfree-verify-dispatch` API with the original page's request contract. Direct order updates, other RPCs/functions/tables and BD reads are blocked by the adapter. Production data client, global site layout, marketing scripts and production credentials are absent from the bundle. `build.mjs` checks this and emits a source hash/input manifest. The regular application uses its original Supabase client; its only UI change is an accurate Live/Sandbox label.

From repository root:

```
npm ci --ignore-scripts
npm ci --prefix sandbox/admin-orders --ignore-scripts
npm run build --prefix sandbox/admin-orders
node sandbox/admin-orders/client.test.cjs
npm run typecheck
```

Deploy only `dist/index.html`, `dist/app.js`, `dist/style.css`, `dist/sandbox.css`, and `dist/vercel.json` as a static Preview under the existing gaziseed Vercel project. Never promote it to Production. No project environment-variable changes are needed. Keep PR #277 draft/Production blocked; do not modify PR #276.

Browser acceptance remains pending until the user signs in to this new Preview. Verify fake local paid/refund blocks, successful Sandbox payment verification and shipped update, persisted history/audit and replay protection using the actual component controls. Prior standalone harness/main-API successes do not by themselves certify this component integration.

Preview deployed: https://gaziseed-6zjcqdqmw-gazi-seed.vercel.app/
