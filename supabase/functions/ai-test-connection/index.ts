import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { provider, api_key, model, base_url } = await req.json();

    if (!api_key) {
      return new Response(
        JSON.stringify({ success: false, message: "API key is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let testUrl: string;
    let headers: Record<string, string>;

    switch (provider) {
      case "openai": {
        testUrl = `${base_url || "https://api.openai.com/v1"}/models`;
        headers = { "Authorization": `Bearer ${api_key}` };
        break;
      }
      case "gemini": {
        const m = model || "gemini-1.5-flash";
        testUrl = `${base_url || "https://generativelanguage.googleapis.com/v1beta"}/models/${m}?key=${api_key}`;
        headers = {};
        break;
      }
      case "claude": {
        testUrl = `${base_url || "https://api.anthropic.com/v1"}/models`;
        headers = { "x-api-key": api_key, "anthropic-version": "2023-06-01" };
        break;
      }
      case "custom": {
        if (!base_url) {
          return new Response(
            JSON.stringify({ success: false, message: "Base URL is required for custom providers" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        testUrl = `${base_url}/models`;
        headers = { "Authorization": `Bearer ${api_key}` };
        break;
      }
      default:
        return new Response(
          JSON.stringify({ success: false, message: "Unknown provider" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    const res = await fetch(testUrl, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return new Response(
        JSON.stringify({ success: false, message: `${provider} API error: ${res.status} ${res.statusText}` }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `${provider} connection successful` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: `Connection failed: ${err instanceof Error ? err.message : "Unknown error"}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
