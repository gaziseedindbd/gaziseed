import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const CASHFREE_API_VERSION = "2025-01-01";
const CASHFREE_ORDERS_URL = "https://api.cashfree.com/pg/orders";
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}
function secretKey() {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!raw) throw new Error("Supabase secret keys unavailable");
  return JSON.parse(raw)["default"] as string;
}
function publishableKey() {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  return raw ? JSON.parse(raw)["default"] as string : null;
}
function moneyMatches(a: number, b: number) {
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 0.01;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const appId = Deno.env.get("CASHFREE_APP_ID");
  const cashfreeSecret = Deno.env.get("CASHFREE_SECRET_KEY");
  if (!appId || !cashfreeSecret) {
    return json({ ok: false, error: "Cashfree credentials are not configured" }, 500);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }
  const paymentIntentId =
    typeof body.payment_intent_id === "string" ? body.payment_intent_id.trim() : "";
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(paymentIntentId)) {
    return json({ ok: false, error: "payment_intent_id is invalid" }, 400);
  }

  let userId: string | null = null;
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const key = publishableKey();
      if (key) {
        const userClient = createClient(Deno.env.get("SUPABASE_URL")!, key, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data } = await userClient.auth.getUser();
        userId = data.user?.id ?? null;
      }
    } catch {
      // Guest checkout remains supported; intent ownership is checked below.
    }
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, secretKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: intent, error: intentError } = await admin
    .from("cashfree_payment_intents")
    .select("id,user_id,country_code,currency,amount,status,completed_order_id,cashfree_order_id")
    .eq("id", paymentIntentId)
    .maybeSingle();

  if (intentError || !intent) {
    return json({ ok: false, error: "Payment intent not found" }, 404);
  }
  if (intent.user_id && intent.user_id !== userId) {
    return json({ ok: false, error: "Payment intent does not belong to this user" }, 403);
  }
  if (intent.country_code !== "IN" || intent.currency !== "INR" ||
      !Number.isFinite(Number(intent.amount)) || Number(intent.amount) <= 0) {
    return json({ ok: false, error: "Invalid India payment intent" }, 409);
  }
  if (!intent.cashfree_order_id) {
    return json({ ok: false, error: "Cashfree order is not initialized" }, 409);
  }

  let gateway: Record<string, unknown>;
  try {
    const response = await fetch(
      CASHFREE_ORDERS_URL + "/" + encodeURIComponent(intent.cashfree_order_id),
      {
        method: "GET",
        headers: {
          "x-api-version": CASHFREE_API_VERSION,
          "x-client-id": appId,
          "x-client-secret": cashfreeSecret,
          "x-request-id": crypto.randomUUID(),
        },
      },
    );
    if (!response.ok) {
      return json({ ok: false, error: "Cashfree order status check failed" }, 502);
    }
    gateway = await response.json();
  } catch {
    return json({ ok: false, error: "Cashfree order status check unavailable" }, 502);
  }

  // A gateway PAID response is not trusted until its order ID, INR currency,
  // and exact amount match the server-created intent.
  const gatewayOrderId = typeof gateway.order_id === "string" ? gateway.order_id : "";
  const gatewayCurrency = typeof gateway.order_currency === "string" ? gateway.order_currency : "";
  const gatewayAmount = Number(gateway.order_amount);
  if (gatewayOrderId !== intent.cashfree_order_id || gatewayCurrency !== "INR" ||
      !moneyMatches(gatewayAmount, Number(intent.amount))) {
    return json({ ok: false, error: "Cashfree order identity, currency, or amount mismatch" }, 409);
  }

  const orderStatus = typeof gateway.order_status === "string" ? gateway.order_status : "";
  const paid = orderStatus === "PAID";
  if (intent.completed_order_id) {
    return json({
      ok: true,
      already_completed: true,
      payment_intent_id: intent.id,
      cashfree_order_id: intent.cashfree_order_id,
      order_status: orderStatus,
      paid,
      status: intent.status,
      order_amount: gatewayAmount,
      order_currency: gatewayCurrency,
    });
  }

  // Only eligible, unlinked intents may transition. Never overwrite a live
  // processing claim or a completed intent if webhook/return processing races.
  const nextStatus = paid
    ? "paid"
    : (orderStatus === "EXPIRED" || orderStatus === "TERMINATED" ? "failed" : "pending");
  const allowedFrom = paid
    ? ["created", "pending", "failed", "paid"]
    : ["created", "pending"];
  const updatePatch: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (paid) updatePatch.paid_at = new Date().toISOString();

  const { data: changed, error: updateError } = await admin
    .from("cashfree_payment_intents")
    .update(updatePatch)
    .eq("id", paymentIntentId)
    .is("completed_order_id", null)
    .in("status", allowedFrom)
    .select("status")
    .maybeSingle();

  if (updateError) {
    return json({ ok: false, error: "Verified payment state could not be recorded" }, 502);
  }

  // Concurrent completion may have claimed or completed the intent first.
  let storedStatus = changed?.status || intent.status;
  if (!changed) {
    const { data: latest, error: latestError } = await admin
      .from("cashfree_payment_intents")
      .select("status,completed_order_id")
      .eq("id", paymentIntentId)
      .maybeSingle();
    if (latestError || !latest) {
      return json({ ok: false, error: "Payment state could not be confirmed" }, 502);
    }
    storedStatus = latest.status;
    if (latest.completed_order_id) {
      return json({
        ok: true,
        already_completed: true,
        payment_intent_id: intent.id,
        cashfree_order_id: intent.cashfree_order_id,
        order_status: orderStatus,
        paid,
        status: storedStatus,
        order_amount: gatewayAmount,
        order_currency: gatewayCurrency,
      });
    }
  }

  return json({
    ok: true,
    payment_intent_id: intent.id,
    cashfree_order_id: intent.cashfree_order_id,
    order_status: orderStatus,
    paid,
    status: storedStatus,
    order_amount: gatewayAmount,
    order_currency: gatewayCurrency,
  });
});
