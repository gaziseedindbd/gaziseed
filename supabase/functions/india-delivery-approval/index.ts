import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.112.3";

const cors = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type,x-gazi-country"};
// Records explicit India admin approval after packing.
// Deliberately does not call an external pickup endpoint.
Deno.serve(async (request: Request) => {
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, "content-type": "application/json", "cache-control": "no-store" },
  });
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
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
  // Database locks the packed order and records first approval atomically.
  const {data:approved,error}=await admin.rpc('approve_india_shipping_pickup',{
    p_order:orderId,p_actor:userResult.user.id,
  });
  if (error) return reply(503, { ok: false });
  if (!approved) return reply(409, { ok: false, reason: "Shipment is not ready or already approved" });
  return reply(200, { ok: true, approved: true });
});
