/** Authenticated, read-only diagnostics. No booking, wallet or pickup APIs. */
type Env = Record<string, string | undefined>;
const sandbox = 'https://qqehtphbpypcmxliaiqd.supabase.co';
const production = 'https://ufxsthshyebahkwbmioe.supabase.co';
export const connectionCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type, x-gazi-country, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Max-Age': '600',
};
export function createIndiaConnectionCheck(deps: {
  env: Env; authenticate: (req: Request) => Promise<boolean>; fetcher?: typeof fetch;
}) {
  return async (req: Request): Promise<Response> => {
    const reply = (status: number, body: Record<string, unknown>) => Response.json(body, {
      status, headers: {...connectionCors, 'Cache-Control': 'no-store'},
    });
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers: connectionCors});
    if (req.method !== 'POST') return reply(405, {ok: false, code: 'method_not_allowed'});
    if (!/^Bearer\s+\S+$/.test(req.headers.get('authorization') ?? ''))
      return reply(401, {ok: false, code: 'admin_login_required'});
    try {
      if (!await deps.authenticate(req)) return reply(403, {ok: false, code: 'india_admin_required'});
    } catch { return reply(401, {ok: false, code: 'admin_login_required'}); }
    const url = deps.env.SUPABASE_URL;
    if (url !== sandbox && url !== production) return reply(503, {ok: false, code: 'untrusted_project'});
    const testOnly = url === sandbox;
    const email = deps.env[testOnly ? 'SHIPROCKET_SANDBOX_API_EMAIL' : 'SHIPROCKET_API_EMAIL'];
    const password = deps.env[testOnly ? 'SHIPROCKET_SANDBOX_API_PASSWORD' : 'SHIPROCKET_API_PASSWORD'];
    const endpoint = testOnly ? 'https://api-sandbox.shiprocket.in/v1/external/auth/login'
      : 'https://apiv2.shiprocket.in/v1/external/auth/login';
    const report = {
      test_only: testOnly, environment: testOnly ? 'sandbox' : 'production',
      stage: 'provider_authentication', admin_authorized: true,
      credentials_configured: !!email && !!password,
      noShipmentCreated: true, database_modified: false, pickup_requested: false,
      endpoint,
    };
    if (!email || !password) return reply(200, {...report, ok: false, code: 'credentials_unavailable'});
    try {
      const response = await (deps.fetcher ?? fetch)(endpoint, {
        method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'},
        body: JSON.stringify({email, password}), redirect: 'error',
        signal: AbortSignal.timeout(12000), cache: 'no-store',
      });
      const provider = {provider_http_status: response.status,
        provider_response_type: response.headers.get('content-type')?.split(';')[0] ?? 'unknown'};
      if (!response.ok) return reply(200, {...report, ...provider, ok: false,
        code: response.status === 401 || response.status === 403 ? 'provider_auth_rejected'
          : response.status === 498 ? 'provider_access_denied' : 'provider_unavailable'});
      const value: unknown = await response.json();
      if (!value || typeof value !== 'object' || !('token' in value) ||
        typeof value.token !== 'string' || value.token.length < 16)
        return reply(200, {...report, ...provider, ok: false, code: 'provider_invalid_response'});
      return reply(200, {...report, ...provider, ok: true, authenticated: true, scope: 'india_only'});
    } catch { return reply(200, {...report, ok: false, code: 'provider_network_or_response_error'}); }
  };
}
