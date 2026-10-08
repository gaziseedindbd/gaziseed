import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map(Number);
  if (octets.some((value) => value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return (
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a === 0
  );
}

function isUnsafeHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "::1" ||
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:") ||
    isPrivateIpv4(host)
  );
}

function normalizeBaseUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || isUnsafeHost(url.hostname)) return null;
    url.pathname = url.pathname.replace(/\/+$/, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function requireActiveAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) return { ok: false as const, status: 401, message: "Authentication required" };

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRole) {
    return { ok: false as const, status: 500, message: "Server configuration incomplete" };
  }

  const sb = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error: userError } = await sb.auth.getUser(token);
  if (userError || !user) {
    return { ok: false as const, status: 401, message: "Authentication required" };
  }

  const { data: adminRow, error: adminError } = await sb
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (adminError) {
    return { ok: false as const, status: 500, message: "Admin verification failed" };
  }

  if (!adminRow) {
    return { ok: false as const, status: 403, message: "Admin access required" };
  }

  return { ok: true as const };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, message: "Method not allowed" }, 405);
  }

  const auth = await requireActiveAdmin(req);
  if (!auth.ok) {
    return json({ success: false, message: auth.message }, auth.status);
  }

  try {
    const { provider, api_key, model, base_url } = await req.json();

    if (typeof api_key !== "string" || !api_key.trim()) {
      return json({ success: false, message: "API key is required" }, 400);
    }

    const customBaseUrl = base_url ? normalizeBaseUrl(base_url) : null;
    if (base_url && !customBaseUrl) {
      return json(
        {
          success: false,
          message: "Base URL must be a public HTTPS endpoint",
        },
        400,
      );
    }

    let testUrl: string;
    let headers: Record<string, string>;

    switch (provider) {
      case "openai": {
        testUrl = `${customBaseUrl || "https://api.openai.com/v1"}/models`;
        headers = { "Authorization": `Bearer ${api_key}` };
        break;
      }
      case "gemini": {
        const m = typeof model === "string" && model.trim()
          ? model.trim()
          : "gemini-1.5-flash";
        testUrl =
          `${customBaseUrl || "https://generativelanguage.googleapis.com/v1beta"}/models/${encodeURIComponent(m)}?key=${encodeURIComponent(api_key)}`;
        headers = {};
        break;
      }
      case "claude": {
        testUrl = `${customBaseUrl || "https://api.anthropic.com/v1"}/models`;
        headers = {
          "x-api-key": api_key,
          "anthropic-version": "2023-06-01",
        };
        break;
      }
      case "custom": {
        if (!customBaseUrl) {
          return json(
            { success: false, message: "A public HTTPS Base URL is required for custom providers" },
            400,
          );
        }
        testUrl = `${customBaseUrl}/models`;
        headers = { "Authorization": `Bearer ${api_key}` };
        break;
      }
      default:
        return json({ success: false, message: "Unknown provider" }, 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    try {
      const res = await fetch(testUrl, {
        headers,
        signal: controller.signal,
        redirect: "error",
      });

      if (!res.ok) {
        return json(
          {
            success: false,
            message: `${provider} API error: ${res.status} ${res.statusText}`,
          },
          200,
        );
      }

      return json({
        success: true,
        message: `${provider} connection successful`,
      });
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    return json(
      {
        success: false,
        message: `Connection failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      },
      500,
    );
  }
});
