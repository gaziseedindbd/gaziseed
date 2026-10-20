// Build-time replacement for the real AdminOrdersPage's data client.
// No Production fallback, PostgREST access, persistent token, or general writes.
export const BASE = 'https://qqehtphbpypcmxliaiqd.supabase.co';
export const KEY = 'sb_publishable_dnKRFnZRxkj-DZ9nobbIXw_1eAVHtoX';
let token = '';
export function signOut() { token = ''; }
export async function signIn(email: string, password: string) {
  const response = await fetch(BASE + '/auth/v1/token?grant_type=password', {
    method: 'POST', headers: { apikey: KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw Error('Sandbox login failed');
  token = data.access_token;
  const check = await call('sandbox-admin-dispatch-preview', { action: 'list' });
  if (check.error) { signOut(); throw Error('Active India Sandbox admin required'); }
}
export async function call(name: string, body: Record<string, unknown>) {
  if (!['cashfree-verify-dispatch', 'sandbox-admin-dispatch-preview'].includes(name))
    return { data: null, error: { message: 'Sandbox function not allowed' } };
  if (!token) return { data: null, error: { message: 'Sandbox login required' } };
  try {
    const response = await fetch(BASE + '/functions/v1/' + name, {
      method: 'POST', headers: { apikey: KEY, authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000),
    });
    const data = await response.json();
    return { data, error: response.ok ? null : { message: data.error || 'Sandbox operation blocked' } };
  } catch { return { data: null, error: { message: 'Sandbox connection unavailable' } }; }
}
function from(table: string) {
  const filters: Record<string, unknown> = {};
  let insert: any = null, write = false;
  const query = {
    select() { return query; }, eq(key: string, value: unknown) { filters[key] = value; return query; },
    order() { return query; },
    update() { write = true; return query; },
    insert(value: unknown) { insert = value; return query; },
    then(resolve: any, reject: any) {
      const run = async () => {
        if (write) return { data: null, error: { message: 'Sandbox: use verified shipped transition only' } };
        if (table === 'order_status_history' && insert) {
          return call('sandbox-admin-dispatch-preview', { action: 'history', orderId: insert.order_id, status: insert.status, note: insert.note });
        }
        if (table === 'orders' && !insert && filters.country_code === 'IN') {
          const r = await call('sandbox-admin-dispatch-preview', { action: 'list' });
          return { ...r, data: r.data?.orders ?? [] };
        }
        if (table === 'order_items' && !insert && typeof filters.order_id === 'string') {
          const r = await call('sandbox-admin-dispatch-preview', { action: 'items', orderId: filters.order_id });
          return { ...r, data: r.data?.items ?? [] };
        }
        return { data: null, error: { message: 'Sandbox query not allowed' } };
      };
      return run().then(resolve, reject);
    },
  };
  return query;
}
export const supabase = {
  auth: { getSession: async () => ({ data: { session: token ? { access_token: token } : null } }) },
  functions: { invoke: (name: string, options: { body: Record<string, unknown> }) => call(name, options.body) },
  from,
  rpc: async (name: string, args?: Record<string, unknown>) => {
    if (name === 'current_admin_country') {
      const r = await call('sandbox-admin-dispatch-preview', { action: 'list' });
      return { data: r.error ? null : 'IN', error: r.error };
    }
    if (name === 'get_order_payment_audit') {
      const r = await call('sandbox-admin-dispatch-preview', { action: 'audit', orderId: args?.p_order_id });
      return { ...r, data: r.data?.entries ?? [] };
    }
    return { data: null, error: { message: 'Sandbox RPC not allowed' } };
  },
};

export const cashfreeEnvironmentLabel = "Sandbox";
