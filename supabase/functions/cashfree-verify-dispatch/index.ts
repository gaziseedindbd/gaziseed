import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-gazi-country",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: cors });
const fail = (error: string, status = 409) => reply({ ok: false, error }, status);
const moneyMatches = (a: number, b: number) =>
  Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.01;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Method not allowed", 405);

  const url = Deno.env.get("SUPABASE_URL");
  const publicKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const cfId = Deno.env.get("CASHFREE_APP_ID");
  const cfSecret = Deno.env.get("CASHFREE_SECRET_KEY");
  if (!url || !publicKeys || !secretKeys || !cfId || !cfSecret)
    return fail("Payment verification configuration unavailable. Hold dispatch.", 503);

  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return fail("Admin login required", 401);

  const client = createClient(url, JSON.parse(publicKeys).default, {
    global: { headers: { Authorization: authorization, "x-gazi-country": "IN" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: who, error: whoError } = await client.auth.getUser(authorization.slice(7));
  if (whoError || !who.user) return fail("Admin session invalid", 401);

  const [adminCheck, countryCheck] = await Promise.all([
    client.rpc("is_admin"),
    client.rpc("current_admin_country"),
  ]);
  if (adminCheck.error || countryCheck.error || adminCheck.data !== true ||
      String(countryCheck.data || "").toUpperCase() !== "IN")
    return fail("India admin access required", 403);

  let body: { orderId?: string; status?: string; note?: string };
  try { body = await req.json(); } catch { return fail("Invalid JSON", 400); }
  if (!body.orderId || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.orderId) ||
      body.status !== "shipped")
    return fail("Expected an order ID and shipped status", 400);

  const admin = createClient(url, JSON.parse(secretKeys).default, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: order, error: orderError } = await admin.from("orders")
    .select("id,country_code,status,payment_method,payment_status,final_amount,payment_advance_amount,payment_due_amount")
    .eq("id", body.orderId).maybeSingle();
  if (orderError || !order || order.country_code !== "IN" || order.status !== "packed")
    return fail("India order must be packed before dispatch");

  const requiresPaidVerification = ["online", "cashfree"].includes(String(order.payment_method || "").toLowerCase()) ||
    ["paid", "partially_paid"].includes(String(order.payment_status || "").toLowerCase()) ||
    Number(order.payment_advance_amount || 0) > 0;
  if (!requiresPaidVerification) return fail("Use normal dispatch for non-paid orders");

  const { data: intents, error: intentError } = await admin.from("cashfree_payment_intents")
    .select("id,cashfree_order_id,amount,currency,status,completed_order_id,metadata")
    .eq("completed_order_id", order.id).eq("status", "completed");

  if (intentError || !intents || intents.length !== 1)
    return fail("Exactly one completed Cashfree intent is required. Hold dispatch.");
  const intent = intents[0];
  const cod = intent.metadata?.payment_method === "cod";
  const expected = cod ? Number(order.payment_advance_amount) : Number(order.final_amount);
  if (!Number.isFinite(expected) || expected <= 0 || intent.currency !== "INR" ||
      !moneyMatches(Number(intent.amount), expected) || !intent.cashfree_order_id ||
      (cod && (!Number.isFinite(Number(order.payment_due_amount)) || Number(order.payment_due_amount) < 0)) ||
      (!cod && Number(order.payment_due_amount || 0) !== 0))
    return fail("Cashfree amount or due balance mismatch. Hold dispatch.");

  let cf: { order_status?: string; order_amount?: number; order_currency?: string };
  try {
    const response = await fetch(
      "https://api.cashfree.com/pg/orders/" + encodeURIComponent(intent.cashfree_order_id),
      { method: "GET", headers: {
        "x-api-version": "2025-01-01",
        "x-client-id": cfId,
        "x-client-secret": cfSecret,
      } },
    );
    if (!response.ok) return fail("Cashfree lookup unavailable. Hold dispatch.", 502);
    cf = await response.json();
  } catch { return fail("Cashfree lookup failed. Hold dispatch.", 502); }

  if (cf.order_status !== "PAID" || cf.order_currency !== "INR" ||
      !moneyMatches(Number(cf.order_amount), expected))
    return fail("Cashfree did not verify the correct paid amount. Hold dispatch.");

  // A PAID order can subsequently be refunded. Fail closed on refund API errors.
  try {
    const refundsResponse = await fetch(
      "https://api.cashfree.com/pg/orders/" + encodeURIComponent(intent.cashfree_order_id) + "/refunds",
      { method: "GET", headers: {
        "x-api-version": "2025-01-01",
        "x-client-id": cfId,
        "x-client-secret": cfSecret,
      } },
    );
    if (!refundsResponse.ok) return fail("Unable to verify refund status. Hold dispatch.", 502);
    const refunds = await refundsResponse.json();
    if (!Array.isArray(refunds)) return fail("Unexpected Cashfree refund response. Hold dispatch.", 502);
    if (refunds.some((refund: { refund_status?: string }) =>
      !["FAILED", "CANCELLED"].includes(String(refund.refund_status || "").toUpperCase())))
      return fail("Cashfree refund or refund processing found. Hold dispatch.");
  } catch { return fail("Unable to verify refund status. Hold dispatch.", 502); }

  const { data: updated, error: updateError } = await admin.from("orders").update({
    status: "shipped",
    internal_notes: typeof body.note === "string" ? body.note.slice(0, 2000) : "",
    cashfree_dispatch_verified_at: new Date().toISOString(),
  }).eq("id", order.id).eq("status", "packed").select("id,status").maybeSingle();

  if (updateError || !updated) return fail("Verified dispatch failed or order changed.");
  return reply({ ok: true, verified: true, status: updated.status });
});
