import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

type Row = Record<string, unknown>;
const isRecord = (v: unknown): v is Row => !!v && typeof v === "object" && !Array.isArray(v);
const clean = (v: unknown, max = 240) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const reply = (status: number, body: Row) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});
function constantTimeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let difference = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) difference |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return difference === 0;
}
function toIso(value: unknown): string | null {
  let n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  if (Number.isFinite(n) && n > 0) {
    if (n < 1_000_000_000_000) n *= 1000;
    const d = new Date(n);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  if (typeof value === "string" && value.trim()) {
    const n2 = Date.parse(value);
    return Number.isFinite(n2) ? new Date(n2).toISOString() : null;
  }
  return null;
}
async function verifySignature(raw: Uint8Array, secret: string, headers: Headers): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, raw));
  const hex = Array.from(digest, b => b.toString(16).padStart(2, "0")).join("");
  let binary = "";
  for (const b of digest) binary += String.fromCharCode(b);
  const base64 = btoa(binary);
  const base64url = base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  // Ekart's published API schema specifies a body HMAC but leaves the HTTP
  // signature header name and digest encoding unspecified. Compare candidate
  // digests from headers only; never accept a plain secret or unsigned event.
  const candidates: string[] = [];
  for (const value of headers.values()) {
    const found = value.match(/[A-Fa-f0-9]{64}|[A-Za-z0-9+/_=-]{43,44}/g) ?? [];
    candidates.push(...found);
  }
  return candidates.some(candidate =>
    constantTimeEqual(candidate.toLowerCase(), hex) ||
    constantTimeEqual(candidate, base64) ||
    constantTimeEqual(candidate, base64url)
  );
}
Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return reply(405, { ok: false });
  const secret = Deno.env.get("EKART_WEBHOOK_SECRET") ?? "";
  if (secret.length < 6 || secret.length > 30) return reply(503, { ok: false });
  const length = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(length) && length > 32768) return reply(413, { ok: false });
  let raw: Uint8Array;
  try {
    raw = new Uint8Array(await request.arrayBuffer());
  } catch {
    return reply(400, { ok: false });
  }
  if (raw.length < 2 || raw.length > 32768) return reply(413, { ok: false });
  let authenticated = false;
  try { authenticated = await verifySignature(raw, secret, request.headers); } catch { authenticated = false; }
  if (!authenticated) return reply(401, { ok: false });
  let data: Row;
  try {
    const decoded: unknown = JSON.parse(new TextDecoder().decode(raw));
    if (!isRecord(decoded)) return reply(400, { ok: false });
    data = decoded;
  } catch {
    return reply(400, { ok: false });
  }
  const ekartId = clean(data.id, 80);
  const wbn = clean(data.wbn, 80);
  const status = clean(data.status, 120);
  const occurredAt = toIso(data.ctime);
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(ekartId) || !/^[A-Za-z0-9_-]{4,80}$/.test(wbn) || !status || !occurredAt)
    return reply(400, { ok: false });

  const endpoint = Deno.env.get("SUPABASE_URL") ?? "";
  const keysRaw = Deno.env.get("SUPABASE_SECRET_KEYS") ?? "";
  if (!endpoint || !keysRaw) return reply(503, { ok: false });
  let serviceKey = "";
  try {
    const keys: unknown = JSON.parse(keysRaw);
    if (isRecord(keys) && typeof keys.default === "string") serviceKey = keys.default;
  } catch { /* fail closed below */ }
  if (!serviceKey) return reply(503, { ok: false });
  const db = createClient(endpoint, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let shipmentResult = await db.from("india_shipping_shipments")
    .select("id,awb,tracking_status,tracking_occurred_at,ekart_tracking_payload")
    .eq("provider", "ekart").eq("country_code", "IN").eq("external_shipment_id", ekartId).maybeSingle();
  if (shipmentResult.error) return reply(503, { ok: false });
  if (!shipmentResult.data) {
    shipmentResult = await db.from("india_shipping_shipments")
      .select("id,awb,tracking_status,tracking_occurred_at,ekart_tracking_payload")
      .eq("provider", "ekart").eq("country_code", "IN").eq("awb", wbn).maybeSingle();
    if (shipmentResult.error) return reply(503, { ok: false });
  }
  const shipment = shipmentResult.data;
  if (!shipment) return reply(200, { ok: true, ignored: true });
  if (shipment.awb && shipment.awb !== wbn) return reply(409, { ok: false });

  const eventKey = JSON.stringify([
    ekartId, wbn, status, occurredAt, clean(data.desc, 200), clean(data.location, 120),
  ]);
  const eventTime = new Date(occurredAt).getTime();
  const syncedAt = new Date().toISOString();
  const { error: eventError } = await db.from("india_shipping_webhook_events").insert({
    shipment_id: shipment.id,
    event_key: eventKey,
    event_status: status,
    event_occurred_at: occurredAt,
  });
  if (eventError && eventError.code !== "23505") return reply(503, { ok: false });

  const existingTime = shipment.tracking_occurred_at ? Date.parse(shipment.tracking_occurred_at) : NaN;
  if (Number.isFinite(existingTime) && eventTime < existingTime) return reply(200, { ok: true, stale: true });

  const timelineEvent = {
    status,
    timestamp: occurredAt,
    location: clean(data.location, 120),
    description: clean(data.desc, 200),
  };
  const previous = isRecord(shipment.ekart_tracking_payload) ? shipment.ekart_tracking_payload : {};
  const oldHistory = Array.isArray(previous.history) ? previous.history.filter(isRecord) : [];
  const withoutSame = oldHistory.filter((item: Row) =>
    !(String(item.timestamp ?? "") === occurredAt && String(item.status ?? "") === status)
  );
  const history = [...withoutSame.slice(-79), timelineEvent];
  const normalized = status.toLowerCase();
  const pickupTime = toIso(data.pickupTime);
  const delivered = ["delivered", "delivered successfully", "delivered to customer", "delivered to consignee"].includes(normalized);
  const update: Row = {
    tracking_status: status,
    tracking_occurred_at: occurredAt,
    ekart_tracking_payload: { status, history },
    ekart_last_synced_at: syncedAt,
    updated_at: syncedAt,
    ...(pickupTime ? { ekart_picked_up_at: pickupTime } : {}),
    ...(delivered ? { ekart_delivered_at: occurredAt } : {}),
  };
  const { data: updated, error: updateError } = await db.from("india_shipping_shipments")
    .update(update).eq("id", shipment.id).eq("provider", "ekart").eq("country_code", "IN")
    .select("id").maybeSingle();
  if (updateError || !updated) return reply(503, { ok: false });
  return reply(200, { ok: true });
});
