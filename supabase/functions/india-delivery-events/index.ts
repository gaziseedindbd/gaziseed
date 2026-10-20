import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

import {indiaTrackingTimestamp} from '../india-shipping-booking/core/india-tracking.ts';

// Event-only ingestion. Does not create shipments, update payment, or request pickups.
Deno.serve(async (request: Request) => {
  const reply = (code: number, body: object) => new Response(JSON.stringify(body), {
    status: code, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
  if (request.method !== "POST") return reply(405, { ok: false });
  const key = Deno.env.get("INDIA_DELIVERY_WEBHOOK_TOKEN");
  const supplied = request.headers.get("x-api-key");
  if (!key || key.length < 32 || !supplied) return reply(401, { ok: false });
  const encoder = new TextEncoder();
  const expected = encoder.encode(key), received = encoder.encode(supplied);
  let difference = expected.length ^ received.length;
  for (let i = 0; i < Math.max(expected.length, received.length); i++)
    difference |= (expected[i] ?? 0) ^ (received[i] ?? 0);
  if (difference !== 0) return reply(401, { ok: false });
  let data: Record<string, unknown>;
  try {
    const body = await request.text();
    if (body.length > 32768) return reply(413, { ok: false });
    const decoded: unknown = JSON.parse(body);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return reply(400, { ok: false });
    data = decoded as Record<string, unknown>;
  } catch { return reply(400, { ok: false }); }
  const reference = data.shipment_id;
  const awb = data.awb;
  const status = data.current_status ?? data.status;
  if (((typeof reference !== "string" && typeof reference !== "number") &&
       (typeof awb !== "string" && typeof awb !== "number")) ||
      typeof status !== "string" || status.length > 100 || !status ||
      (awb !== undefined && typeof awb !== "string" && typeof awb !== "number"))
    return reply(400, { ok: false });
  const endpoint = Deno.env.get("SUPABASE_URL");
  const secrets = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!endpoint || !secrets) return reply(503, { ok: false });
  const admin = createClient(endpoint, JSON.parse(secrets).default, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const byReference = reference !== undefined && reference !== null
    ? await admin.from("india_shipping_shipments").select("id,awb").eq("external_shipment_id", String(reference)).maybeSingle()
    : { data: null, error: null };
  if (byReference.error) return reply(503, { ok: false });
  // Shiprocket may send its own shipment reference alongside the AWB. Resolve
  // by AWB only if the primary reference is not in our India-only mapping.
  const byAwb = !byReference.data && awb !== undefined && awb !== null
    ? await admin.from("india_shipping_shipments").select("id,awb").eq("awb", String(awb)).maybeSingle()
    : { data: null, error: null };
  if (byAwb.error) return reply(503, { ok: false });
  const shipment = byReference.data ?? byAwb.data;
  if (!shipment) return reply(200, { ok: true, ignored: true });
  if (awb !== undefined && shipment.awb && String(shipment.awb) !== String(awb))
    return reply(409, { ok: false });
  const eventId = data.event_id;
  const time = data.current_timestamp ?? data.updated_time;
  const eventKey = JSON.stringify([
    typeof eventId === "string" || typeof eventId === "number" ? String(eventId).slice(0, 100) : "",
    status,
    typeof time === "string" ? time.slice(0, 100) : "",
  ]);
  const { error } = await admin.from("india_shipping_webhook_events")
    .insert({ shipment_id: shipment.id, event_key: eventKey, event_status: status, event_occurred_at: indiaTrackingTimestamp(time) });
  if (error?.code === "23505") return reply(200, { ok: true, duplicate: true });
  if (error) return reply(503, { ok: false });
  return reply(200, { ok: true });
});
