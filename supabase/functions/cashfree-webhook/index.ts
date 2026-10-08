import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {"Content-Type":"application/json"};
const COMPLETE_ORDER_URL = "https://ufxsthshyebahkwbmioe.supabase.co/functions/v1/cashfree-complete-order";
const COMPLETE_COD_ORDER_URL = "https://ufxsthshyebahkwbmioe.supabase.co/functions/v1/cashfree-complete-cod-order";
const COMPLETE_CAMPAIGN_ORDER_URL = "https://ufxsthshyebahkwbmioe.supabase.co/functions/v1/cashfree-campaign-payment";
const MAX_SKEW_MS = 5 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function verifySignature(rawBody: string, timestamp: string, signature: string, secret: string) {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(timestamp + rawBody));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const secret = Deno.env.get("CASHFREE_SECRET_KEY");
  if (!secret) return json({ ok: false, error: "Cashfree credentials are not configured" }, 500);

  const signature = req.headers.get("x-webhook-signature") || "";
  const timestamp = req.headers.get("x-webhook-timestamp") || "";
  const version = req.headers.get("x-webhook-version") || "";
  const rawBody = await req.text();

  if (!signature || !timestamp || !version) return json({ ok: false, error: "Missing Cashfree webhook headers" }, 400);
  if (!await verifySignature(rawBody, timestamp, signature, secret)) return json({ ok: false, error: "Invalid webhook signature" }, 401);

  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); } catch { return json({ ok: false, error: "Invalid webhook JSON" }, 400); }

  const type = typeof payload.type === "string" ? payload.type : "";
  const data = (payload.data && typeof payload.data === "object" ? payload.data : {}) as Record<string, unknown>;
  const order = (data.order && typeof data.order === "object" ? data.order : {}) as Record<string, unknown>;
  const payment = (data.payment && typeof data.payment === "object" ? data.payment : {}) as Record<string, unknown>;
  const cashfreeOrderId = typeof order.order_id === "string" ? order.order_id.trim() : "";
  const paymentStatus = typeof payment.payment_status === "string" ? payment.payment_status : "";

  if (!cashfreeOrderId) return json({ ok: false, error: "Webhook order_id is missing" }, 400);

  const rawSecretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!rawSecretKeys) return json({ ok: false, error: "Supabase secret keys are not configured" }, 500);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, JSON.parse(rawSecretKeys)["default"], {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: intent, error: intentError } = await admin
    .from("cashfree_payment_intents")
    .select("id,status,completed_order_id,amount,currency,metadata")
    .eq("cashfree_order_id", cashfreeOrderId)
    .maybeSingle();

  if (intentError || !intent) return json({ ok: true, ignored: true, reason: "Unknown Cashfree order" });
  if (intent.completed_order_id) return json({ ok: true, already_completed: true, order_id: intent.completed_order_id });

  if (type === "PAYMENT_SUCCESS_WEBHOOK" || paymentStatus === "SUCCESS") {
    if (intent.metadata?.payment_flow === "india_campaign") {
      const response = await fetch(COMPLETE_CAMPAIGN_ORDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${JSON.parse(rawSecretKeys)["default"]}`,
        },
        body: JSON.stringify({ action: "complete", payment_intent_id: intent.id }),
      });
      const responseText = await response.text();
      let result: unknown;
      try { result = JSON.parse(responseText); } catch { result = { raw: responseText }; }
      if (!response.ok) return json({ ok: false, error: "Verified campaign payment could not be completed", details: result }, 502);
      return json({ ok: true, processed: true, payment_flow: "india_campaign", result });
    }

    const isCod = intent.metadata?.payment_method === "cod";
    const completionUrl = isCod ? COMPLETE_COD_ORDER_URL : COMPLETE_ORDER_URL;
    const response = await fetch(completionUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isCod ? {} : { "x-cashfree-internal-secret": secret }),
      },
      body: JSON.stringify({ payment_intent_id: intent.id, cashfree_order_id: cashfreeOrderId }),
    });

    const responseText = await response.text();
    let result: unknown;
    try { result = JSON.parse(responseText); } catch { result = { raw: responseText }; }

    if (!response.ok) {
      return json({
        ok: false,
        error: isCod ? "Verified COD payment received but COD order completion failed" : "Verified online payment received but order completion failed",
        details: result,
      }, 502);
    }
    return json({ ok: true, processed: true, payment_method: isCod ? "cod" : "cashfree", result });
  }

  if (type === "PAYMENT_FAILED_WEBHOOK" || paymentStatus === "FAILED") {
    await admin.from("cashfree_payment_intents").update({
      status: "failed",
      updated_at: new Date().toISOString(),
      metadata: { ...(intent.metadata || {}), last_webhook_type: type, payment_status: paymentStatus },
    }).eq("id", intent.id).in("status", ["created", "pending"]);
    return json({ ok: true, processed: true, status: "failed" });
  }

  if (type === "PAYMENT_USER_DROPPED_WEBHOOK" || paymentStatus === "USER_DROPPED") {
    await admin.from("cashfree_payment_intents").update({
      status: "pending",
      updated_at: new Date().toISOString(),
      metadata: { ...(intent.metadata || {}), last_webhook_type: type, payment_status: paymentStatus },
    }).eq("id", intent.id).in("status", ["created", "pending"]);
    return json({ ok: true, processed: true, status: "pending" });
  }

  return json({ ok: true, ignored: true, type, payment_status: paymentStatus });
});
