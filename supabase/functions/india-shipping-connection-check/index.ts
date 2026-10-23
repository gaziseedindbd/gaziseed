import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

// India-admin-only read-only connectivity probe. NEVER books orders, AWBs or pickups.
// Do not expose provider token, API credentials or raw provider error messages.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-gazi-country", "Access-Control-Max-Age": "600" };
const SANDBOX_SUPABASE_URL = "https://qqehtphbpypcmxliaiqd.supabase.co";
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  const reply = (status: number, body: Record<string, unknown>) =>
    new Response(JSON.stringify(body), {
      status, headers: { ...cors, "content-type": "application/json", "cache-control": "no-store" },
    });
  if (req.method !== "POST") return reply(405, { ok: false });
  const auth = req.headers.get("authorization") ?? "";
  if (!/^Bearer\s+\S+$/.test(auth)) return reply(401, { ok: false });
  const url = Deno.env.get("SUPABASE_URL");
  const publicKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!url || !publicKeys) return reply(503, { ok: false, code: "config_unavailable" });
  try {
    const parsed: unknown = JSON.parse(publicKeys);
    if (!parsed || typeof parsed !== "object" || !("default" in parsed) ||
        typeof parsed.default !== "string") throw new Error("Config unavailable");
    const client = createClient(url, parsed.default, {
      global: { headers: { Authorization: auth, "x-gazi-country": "IN" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: user, error } = await client.auth.getUser(auth.replace(/^Bearer\s+/, ""));
    if (error || !user.user) return reply(401, { ok: false });
    const [isAdmin, country] = await Promise.all([
      client.rpc("is_admin"), client.rpc("current_admin_country"),
    ]);
    if (isAdmin.error || country.error || isAdmin.data !== true ||
        String(country.data ?? "").toUpperCase() !== "IN")
      return reply(403, { ok: false });
    // Shiprocket Support requires this account's Sandbox API tests to run in
    // its official Sandbox Panel. Do not send stored Sandbox credentials from
    // Supabase Edge Functions. Production's read-only check remains unchanged.
    if (url === SANDBOX_SUPABASE_URL)
      return reply(200, { ok: false, code: "sandbox_testing_requires_official_panel" });
    const email = Deno.env.get("SHIPROCKET_API_EMAIL");
    const password = Deno.env.get("SHIPROCKET_API_PASSWORD");
    if (!email || !password) return reply(503, { ok: false, code: "credentials_unavailable" });
    const response = await fetch("https://apiv2.shiprocket.in/v1/external/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!response.ok) return reply(502, {
      ok: false, code: response.status === 401 || response.status === 403
        ? "provider_auth_rejected" : "provider_unavailable",
    });
    const value: unknown = await response.json();
    if (!value || typeof value !== "object" || !("token" in value) ||
        typeof value.token !== "string" || value.token.length < 16)
      return reply(502, { ok: false, code: "provider_invalid_response" });
    // Never return or log token.
    return reply(200, { ok: true, authenticated: true, scope: "india_only",
      noShipmentCreated: true });
  } catch {
    return reply(503, { ok: false, code: "connection_test_failed" });
  }
});
