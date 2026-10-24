import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

// India-admin-only, read-only Delhivery serviceability and rate estimate.
// This function never creates or updates a shipment, AWB, pickup, or database row.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, x-client-info, content-type, x-gazi-country",
  "Access-Control-Max-Age": "600",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json", "cache-control": "no-store" },
  });
const isPin = (v: unknown): v is string => typeof v === "string" && /^[1-9][0-9]{5}$/.test(v);
const validPositive = (v: unknown, max: number): v is number =>
  typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max;
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply(405, { ok: false, code: "method_not_allowed" });

  const authorization = req.headers.get("authorization") ?? "";
  const jwt = authorization.replace(/^Bearer\s+/i, "");
  if (!jwt) return reply(401, { ok: false, code: "authentication_required" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const token = Deno.env.get("DELHIVERY_API_TOKEN");
  const environment = (Deno.env.get("DELHIVERY_API_ENVIRONMENT") ?? "staging").trim().toLowerCase();
  const baseUrl = environment === "staging"
    ? "https://staging-express.delhivery.com"
    : environment === "production"
      ? "https://track.delhivery.com"
      : null;
  if (!supabaseUrl || !publishableKeys || !token || !baseUrl)
    return reply(503, { ok: false, code: "delhivery_configuration_unavailable" });

  try {
    const parsedKeys: unknown = JSON.parse(publishableKeys);
    if (!isRecord(parsedKeys) || typeof parsedKeys.default !== "string")
      return reply(503, { ok: false, code: "configuration_unavailable" });

    const authClient = createClient(supabaseUrl, parsedKeys.default, {
      global: { headers: { Authorization: "Bearer " + jwt, "x-gazi-country": "IN" } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: identity, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !identity.user) return reply(401, { ok: false, code: "authentication_required" });

    const [admin, country] = await Promise.all([
      authClient.rpc("is_admin"),
      authClient.rpc("current_admin_country"),
    ]);
    if (admin.error || country.error || admin.data !== true ||
        String(country.data ?? "").toUpperCase() !== "IN")
      return reply(403, { ok: false, code: "india_admin_only" });

    const input: unknown = await req.json();
    if (!isRecord(input)) return reply(400, { ok: false, code: "invalid_request" });
    const { pickupPin, deliveryPin, weightGrams, lengthCm, breadthCm, heightCm, paymentMode, shippingMode } = input;
    if (!isPin(pickupPin) || !isPin(deliveryPin) ||
        !validPositive(weightGrams, 50000) || !Number.isInteger(weightGrams) ||
        !validPositive(lengthCm, 200) || !validPositive(breadthCm, 200) ||
        !validPositive(heightCm, 200) ||
        (paymentMode !== "cod" && paymentMode !== "prepaid") ||
        (shippingMode !== "surface" && shippingMode !== "express"))
      return reply(400, { ok: false, code: "invalid_parcel" });

    const headers = { Authorization: "Token " + token, Accept: "application/json" };
    const pinUrl = new URL("/c/api/pin-codes/json/", baseUrl);
    pinUrl.searchParams.set("filter_codes", deliveryPin);
    const pinResponse = await fetch(pinUrl, {
      method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(12000),
    });
    if (!pinResponse.ok) return reply(502, {
      ok: false,
      code: pinResponse.status === 401 || pinResponse.status === 403
        ? "delhivery_auth_rejected" : "delhivery_serviceability_unavailable",
      diagnostic: { stage: "serviceability", upstreamStatus: pinResponse.status },
    });

    const pinPayload: unknown = await pinResponse.json();
    if (!isRecord(pinPayload) || !Array.isArray(pinPayload.delivery_codes))
      return reply(502, { ok: false, code: "delhivery_response_invalid", diagnostic: { stage: "serviceability_payload" } });
    const deliveryCodes = pinPayload.delivery_codes.filter(isRecord);
    if (deliveryCodes.length === 0)
      return reply(200, { ok: true, environment, serviceable: false, estimatedCharge: null, quoteOnly: true });

    const matching = deliveryCodes.find((entry) => {
      const postalCode = isRecord(entry.postal_code) ? entry.postal_code : null;
      return postalCode && String(postalCode.pin ?? "") === deliveryPin;
    });
    if (!matching) return reply(502, {
      ok: false, code: "delhivery_response_invalid",
      diagnostic: { stage: "serviceability_pin_mismatch" },
    });
    const postalCode = isRecord(matching.postal_code) ? matching.postal_code : {};
    const remark = typeof postalCode.remark === "string"
      ? postalCode.remark.trim().toLowerCase()
      : typeof matching.remark === "string" ? matching.remark.trim().toLowerCase() : "";
    if (remark === "embargo") return reply(200, {
      ok: true, environment, serviceable: false, reason: "temporarily_embargoed",
      estimatedCharge: null, quoteOnly: true,
    });

    const chargeUrl = new URL("/api/kinko/v1/invoice/charges/.json", baseUrl);
    chargeUrl.searchParams.set("md", shippingMode === "express" ? "E" : "S");
    chargeUrl.searchParams.set("ss", "Delivered");
    chargeUrl.searchParams.set("o_pin", pickupPin);
    chargeUrl.searchParams.set("d_pin", deliveryPin);
    chargeUrl.searchParams.set("cgm", String(weightGrams));
    chargeUrl.searchParams.set("pt", paymentMode === "cod" ? "COD" : "Pre-paid");
    chargeUrl.searchParams.set("l", String(lengthCm));
    chargeUrl.searchParams.set("b", String(breadthCm));
    chargeUrl.searchParams.set("h", String(heightCm));

    const chargeResponse = await fetch(chargeUrl, {
      method: "GET", headers, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!chargeResponse.ok) return reply(502, {
      ok: false, code: "delhivery_rate_unavailable",
      diagnostic: { stage: "rate_http", upstreamStatus: chargeResponse.status },
    });

    const chargePayload: unknown = await chargeResponse.json();
    const chargeRows = Array.isArray(chargePayload)
      ? chargePayload
      : isRecord(chargePayload) && Array.isArray(chargePayload.data) ? chargePayload.data : null;
    if (!chargeRows || chargeRows.length === 0 || !isRecord(chargeRows[0]))
      return reply(502, { ok: false, code: "delhivery_response_invalid", diagnostic: { stage: "rate_payload" } });

    const row = chargeRows[0];
    const amount = Number(row.total_amount);
    const grossAmount = Number(row.gross_amount);
    if (!Number.isFinite(amount) || amount < 0 || amount > 100000)
      return reply(502, { ok: false, code: "delhivery_response_invalid", diagnostic: { stage: "rate_amount" } });

    return reply(200, {
      ok: true,
      environment,
      serviceable: true,
      estimatedCharge: amount,
      grossCharge: Number.isFinite(grossAmount) && grossAmount >= 0 ? grossAmount : null,
      currency: "INR",
      approximate: true,
      quoteOnly: true,
      stagingRatesMayBeZero: environment === "staging",
    });
  } catch {
    return reply(503, { ok: false, code: "delhivery_check_failed" });
  }
});
