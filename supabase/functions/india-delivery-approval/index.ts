import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

// Records explicit India admin approval after packing.
// Deliberately does not call an external pickup endpoint.
Deno.serve(async (request: Request) => {
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
  if (request.method !== "POST") return reply(405, { ok: false });
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return reply(401, { ok: false });
  const url = Deno.env.get("SUPABASE_URL");
  const publicKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  const privateKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (!url || !publicKeys || !privateKeys) return reply(503, { ok: false });
  const client = createClient(url, JSON.parse(publicKeys).default, {
    global: { headers: { Authorization: auth, "x-gazi-country": "IN" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userResult, error: userError } = await client.auth.getUser(auth.slice(7));
  if (userError || !userResult.user) return reply(401, { ok: false });
  const [isAdmin, country] = await Promise.all([
    client.rpc("is_admin"), client.rpc("current_admin_country"),
  ]);
  if (isAdmin.error || country.error || isAdmin.data !== true ||
      String(country.data ?? "").toUpperCase() !== "IN")
    return reply(403, { ok: false });
  let orderId: string;
  try {
    const body = await request.json();
    orderId = body?.orderId;
    if (typeof orderId !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(orderId))
      return reply(400, { ok: false });
  } catch { return reply(400, { ok: false }); }
  const admin = createClient(url, JSON.parse(privateKeys).default, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: order, error: orderError } = await admin.from("orders")
    .select("id,country_code,status").eq("id", orderId).maybeSingle();
  if (orderError || !order || order.country_code !== "IN" || order.status !== "packed")
    return reply(409, { ok: false, reason: "India order must be packed" });
  // Conditional update ensures a second approval cannot replace original approver.
  const { data: approved, error } = await admin.from("india_shipping_shipments")
    .update({ pickup_approved_at: new Date().toISOString(), pickup_approved_by: userResult.user.id })
    .eq("order_id", orderId).eq("country_code", "IN")
    .not("awb", "is", null).not("external_shipment_id", "is", null)
    .is("pickup_approved_at", null).eq("pickup_request_state", "not_requested")
    .select("id").maybeSingle();
  if (error) return reply(503, { ok: false });
  if (!approved) return reply(409, { ok: false, reason: "Shipment is not ready or already approved" });
  return reply(200, { ok: true, approved: true });
});
