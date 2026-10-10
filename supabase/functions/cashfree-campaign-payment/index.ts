import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-gazi-country",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const CASHFREE_API_VERSION = "2025-01-01";
const CASHFREE_ORDERS_URL = "https://api.cashfree.com/pg/orders";
const WEBHOOK_URL = "https://ufxsthshyebahkwbmioe.supabase.co/functions/v1/cashfree-webhook";

type Flow = "ads" | "animated" | "combo";
type Method = "cashfree" | "cod";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS });
}

function adminClient() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  const url = Deno.env.get("SUPABASE_URL");
  if (!raw || !url) throw new Error("Supabase server configuration unavailable");
  return createClient(url, JSON.parse(raw).default as string, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function safeFlow(value: unknown): value is Flow {
  return value === "ads" || value === "animated" || value === "combo";
}

function sanitizeContext(flow: Flow, raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  const uuid = (input: unknown) => typeof input === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input);
  const optionalText = (key: string) => typeof value[key] === "string" ? value[key].trim().slice(0, 300) : "";
  const utm = {
    utm_source: optionalText("utm_source"),
    utm_medium: optionalText("utm_medium"),
    utm_campaign: optionalText("utm_campaign"),
    utm_content: optionalText("utm_content"),
    utm_term: optionalText("utm_term"),
    fbclid: optionalText("fbclid"),
    gclid: optionalText("gclid"),
  };

  if (flow === "ads") {
    if (!uuid(value.landing_page_id) || !uuid(value.product_id)) return null;
    const quantity = Number(value.quantity || 1);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return null;
    if (value.bundle_id && !uuid(value.bundle_id)) return null;
    return {
      landing_page_id: value.landing_page_id,
      product_id: value.product_id,
      quantity,
      bundle_id: value.bundle_id || null,
      ...utm,
    };
  }
  if (flow === "animated") {
    if (!uuid(value.landing_page_id) || !uuid(value.package_id)) return null;
    return { landing_page_id: value.landing_page_id, package_id: value.package_id, ...utm };
  }
  if (!uuid(value.combo_id)) return null;
  const quantity = Number(value.quantity || 1);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return null;
  return { combo_id: value.combo_id, quantity, ...utm };
}

function returnOrigin(request: Request) {
  const origin = request.headers.get("origin") || "";
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && (url.hostname === "gaziseed.com" || url.hostname === "www.gaziseed.com")) {
      return url.origin;
    }
  } catch {
    // Use the canonical production origin below.
  }
  return "https://www.gaziseed.com";
}

async function createSession(request: Request, body: Record<string, unknown>) {
  const appId = Deno.env.get("CASHFREE_APP_ID");
  const cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY");
  if (!appId || !cashfreeSecret) return json({ ok: false, error: "Cashfree credentials are not configured" }, 500);

  const flow = body.flow;
  if (!safeFlow(flow)) return json({ ok: false, error: "Invalid order type" }, 400);
  const context = sanitizeContext(flow, body.context);
  if (!context) return json({ ok: false, error: "Invalid offer selection" }, 400);
  const method: Method = body.payment_method === "cod" ? "cod" : "cashfree";
  const name = typeof body.customer_name === "string" ? body.customer_name.trim().slice(0, 120) : "";
  const phone = typeof body.customer_phone === "string" ? body.customer_phone.replace(/\D/g, "") : "";
  const address = typeof body.delivery_address === "string" ? body.delivery_address.trim().slice(0, 1500) : "";
  const instructions = typeof body.special_instructions === "string" ? body.special_instructions.trim().slice(0, 1000) : "";
  if (!name || !address || !/^[6-9][0-9]{9}$/.test(phone)) {
    return json({ ok: false, error: "Enter a valid name, Indian mobile number and address" }, 400);
  }

  const admin = adminClient();
  const { error: rateLimitError } = await admin.rpc("consume_cashfree_campaign_payment_rate_limit", { p_phone: phone });
  if (rateLimitError) {
    const limited = rateLimitError.message?.includes("Too many payment attempts");
    return json({ ok: false, error: limited ? rateLimitError.message : "Unable to start payment right now" }, limited ? 429 : 500);
  }
  const { data: quote, error: quoteError } = await admin.rpc("quote_india_campaign_order", {
    p_flow: flow,
    p_context: context,
  });
  if (quoteError || !quote?.success) {
    return json({ ok: false, error: quoteError?.message || quote?.error || "Unable to validate this offer" }, 400);
  }
  const total = Number(quote.total);
  const delivery = Number(quote.delivery_charge || 0);
  const advance = method === "cod" ? (delivery > 0 ? delivery : 120) : total;
  if (!Number.isFinite(total) || total <= 0 || !Number.isFinite(advance) || advance <= 0 || advance > total + 0.01) {
    return json({ ok: false, error: "COD advance is higher than the payable order total. Please choose online payment." }, 400);
  }

  const intentId = crypto.randomUUID();
  const cashfreeOrderId = `GS-CF-${crypto.randomUUID()}`;
  const returnUrl = `${returnOrigin(request)}/india-payment-return?payment_intent_id=${encodeURIComponent(intentId)}`;
  const customer = { customer_name: name, customer_phone: phone };
  const metadata = {
    payment_flow: "india_campaign",
    order_flow: flow,
    context,
    payment_method: method,
    quote_subtotal: Number(quote.subtotal),
    quote_delivery: delivery,
    quote_total: total,
    cod_advance: method === "cod" ? advance : 0,
    order_source: flow === "ads" ? "ads" : flow === "animated" ? "animated_landing" : "combo",
  };
  const { error: insertError } = await admin.from("cashfree_payment_intents").insert({
    id: intentId,
    cashfree_order_id: cashfreeOrderId,
    country_code: "IN",
    amount: advance,
    currency: "INR",
    status: "creating",
    user_id: null,
    customer_details: customer,
    delivery_address: address,
    special_instructions: instructions,
    items: [],
    coupon_code: null,
    use_referral_wallet: false,
    wallet_credit_used: 0,
    return_url: returnUrl,
    notify_url: WEBHOOK_URL,
    metadata,
  });
  if (insertError) return json({ ok: false, error: "Unable to create payment record" }, 500);

  try {
    const response = await fetch(CASHFREE_ORDERS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-version": CASHFREE_API_VERSION,
        "x-client-id": appId,
        "x-client-secret": cashfreeSecret,
        "x-request-id": crypto.randomUUID(),
        "x-idempotency-key": intentId,
      },
      body: JSON.stringify({
        order_id: cashfreeOrderId,
        order_amount: Math.round(advance * 100) / 100,
        order_currency: "INR",
        customer_details: { customer_id: `guest-${intentId.slice(0, 12)}`, ...customer },
        order_meta: { return_url: returnUrl, notify_url: WEBHOOK_URL },
      }),
    });
    const providerBody = await response.json().catch(() => ({}));
    if (!response.ok || typeof providerBody.payment_session_id !== "string") {
      await admin.from("cashfree_payment_intents").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", intentId);
      return json({ ok: false, error: "Cashfree could not start this payment" }, 502);
    }
    await admin.from("cashfree_payment_intents").update({
      cf_order_id: providerBody.cf_order_id ?? null,
      cashfree_payment_session_id: providerBody.payment_session_id,
      status: "created",
      updated_at: new Date().toISOString(),
    }).eq("id", intentId).eq("status", "creating");
    return json({
      ok: true,
      payment_intent_id: intentId,
      payment_session_id: providerBody.payment_session_id,
      payment_method: method,
      quote: { subtotal: Number(quote.subtotal), delivery_charge: delivery, total, advance_amount: advance, due_amount: total - advance },
    });
  } catch {
    await admin.from("cashfree_payment_intents").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", intentId);
    return json({ ok: false, error: "Unable to reach Cashfree" }, 502);
  }
}

async function completePayment(body: Record<string, unknown>) {
  const appId = Deno.env.get("CASHFREE_APP_ID");
  const cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY");
  if (!appId || !cashfreeSecret) return json({ ok: false, error: "Cashfree credentials are not configured" }, 500);
  const intentId = typeof body.payment_intent_id === "string" ? body.payment_intent_id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(intentId)) return json({ ok: false, error: "Invalid payment intent" }, 400);

  const admin = adminClient();
  const { data: intent, error } = await admin.from("cashfree_payment_intents").select("*").eq("id", intentId).maybeSingle();
  if (error || !intent || intent.country_code !== "IN" || intent.metadata?.payment_flow !== "india_campaign") {
    return json({ ok: false, error: "Campaign payment was not found" }, 404);
  }
  if (intent.completed_order_id) {
    const { data: order } = await admin.from("orders").select("order_number,payment_advance_amount,payment_due_amount,final_amount").eq("id", intent.completed_order_id).maybeSingle();
    return json({ ok: true, completed: true, already_completed: true, order_id: intent.completed_order_id,
      order_number: order?.order_number, amount: Number(intent.metadata?.quote_total || order?.final_amount || 0),
      advance_amount: Number(order?.payment_advance_amount || 0), due_amount: Number(order?.payment_due_amount || 0) });
  }
  if (!intent.cashfree_order_id || !["created", "pending", "processing"].includes(intent.status)) {
    return json({ ok: false, error: "Payment is not ready to verify" }, 409);
  }

  const providerResponse = await fetch(`${CASHFREE_ORDERS_URL}/${encodeURIComponent(intent.cashfree_order_id)}`, {
    headers: { "x-api-version": CASHFREE_API_VERSION, "x-client-id": appId, "x-client-secret": cashfreeSecret, "x-request-id": crypto.randomUUID() },
  });
  const provider = await providerResponse.json().catch(() => ({}));
  if (!providerResponse.ok) return json({ ok: false, error: "Unable to verify payment with Cashfree" }, 502);
  if (provider.order_status !== "PAID") {
    return json({ ok: true, paid: false, order_status: provider.order_status || "PENDING" });
  }
  const providerAmount = Number(provider.order_amount);
  if (provider.order_id !== intent.cashfree_order_id || !Number.isFinite(providerAmount) || providerAmount <= 0 ||
      !Number.isFinite(Number(intent.amount)) || Number(intent.amount) <= 0 || intent.currency !== "INR" ||
      Math.abs(providerAmount - Number(intent.amount)) > 0.01 || provider.order_currency !== "INR") {
    return json({ ok: false, error: "Paid amount does not match the saved payment" }, 409);
  }

  if (intent.metadata?.payment_method === "cod") {
    try {
      const refundsResponse = await fetch(`${CASHFREE_ORDERS_URL}/${encodeURIComponent(intent.cashfree_order_id)}/refunds`, {
        headers: { "x-api-version": CASHFREE_API_VERSION, "x-client-id": appId, "x-client-secret": cashfreeSecret },
      });
      if (!refundsResponse.ok) return json({ ok: false, error: "Unable to verify COD advance refund status" }, 503);
      const refunds = await refundsResponse.json();
      if (!Array.isArray(refunds) || refunds.some((refund: { refund_status?: string }) =>
        !["FAILED", "CANCELLED"].includes(String(refund.refund_status || "").toUpperCase()))) {
        return json({ ok: false, error: "COD advance refund or refund processing found" }, 409);
      }
    } catch { return json({ ok: false, error: "Unable to verify COD advance refund status" }, 503); }
  }

  const { data: claimed } = await admin.from("cashfree_payment_intents")
    .update({ status: "processing", updated_at: new Date().toISOString() })
    .eq("id", intentId).in("status", ["created", "pending"]).is("completed_order_id", null)
    .select("id").maybeSingle();
  if (!claimed) {
    const { data: latest } = await admin.from("cashfree_payment_intents").select("status,completed_order_id").eq("id", intentId).maybeSingle();
    if (latest?.completed_order_id) return completePayment({ payment_intent_id: intentId });
    if (latest?.status === "processing") return json({ ok: true, processing: true }, 202);
    return json({ ok: false, error: "Payment is already being processed" }, 409);
  }

  const { data: result, error: completionError } = await admin.rpc("complete_cashfree_campaign_order_atomic", {
    p_payment_intent_id: intentId,
  });
  if (completionError || !result?.success) {
    await admin.from("cashfree_payment_intents").update({
      status: "created",
      updated_at: new Date().toISOString(),
      metadata: { ...(intent.metadata || {}), last_completion_error: completionError?.message || result?.error || "Order completion failed" },
    }).eq("id", intentId).eq("status", "processing");
    return json({ ok: false, error: result?.error || completionError?.message || "Payment succeeded but order completion failed" }, 502);
  }
  return json({ ok: true, ...result, completed: true, paid: true });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { status: 200, headers: CORS });
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 32_000) return json({ ok: false, error: "Request is too large" }, 413);
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ ok: false, error: "Invalid request" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
  if (body.action === "create") return createSession(request, body);
  if (body.action === "complete") return completePayment(body);
  return json({ ok: false, error: "Unsupported action" }, 400);
});
