import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentAdminContext, ADMIN_PERMISSION_KEYS } from '@/lib/seed-bari/admin';
import { SEED_BARI_BRAND } from '@/lib/seed-bari/config';

export default async function MasterAdminPage() {
  const context = await getCurrentAdminContext();
  if (!context || context.profile.role !== 'master_admin') redirect('/admin');

  const supabase = await createClient();
  const [{ data: admins }, { data: auditLogs }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id,full_name,email,phone,role,blocked,preferred_country,language,created_at')
      .in('role', ['admin', 'master_admin'])
      .order('created_at', { ascending: false }),
    supabase
      .from('audit_logs')
      .select('id,actor_id,action,entity_type,entity_id,before_data,after_data,created_at')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const adminIds = (admins ?? []).map((admin) => admin.id);
  const [{ data: access }, { data: permissions }] = adminIds.length
    ? await Promise.all([
        supabase.from('admin_country_access').select('user_id,country').in('user_id', adminIds),
        supabase.from('admin_permissions').select('user_id,permission_key,allowed').in('user_id', adminIds),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }];

  return (
    <main className="p-5 md:p-8">
      <div className="max-w-7xl">
        <p className="font-bold text-[#1f6b3b]">{SEED_BARI_BRAND.name}</p>
        <h1 className="mt-1 text-3xl font-black">Master Admin Control Center</h1>
        <p className="mt-2 text-gray-500">Manage admin roles, country access, module permissions, and review security activity.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-gray-500">Admins</p><p className="mt-2 text-3xl font-black">{admins?.length ?? 0}</p></div>
          <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-gray-500">Country assignments</p><p className="mt-2 text-3xl font-black">{access?.length ?? 0}</p></div>
          <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-gray-500">Permission grants</p><p className="mt-2 text-3xl font-black">{(permissions ?? []).filter((x) => x.allowed).length}</p></div>
          <div className="rounded-2xl border bg-white p-5"><p className="text-sm text-gray-500">Recent audit events</p><p className="mt-2 text-3xl font-black">{auditLogs?.length ?? 0}</p></div>
        </div>

        <section className="mt-8 rounded-2xl border bg-white p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">Admin Directory</h2>
              <p className="mt-1 text-sm text-gray-500">Role and access assignments are controlled from the secure admin management layer.</p>
            </div>
            <Link href="/admin/system-health" className="rounded-xl border px-4 py-3 font-bold">System Health</Link>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b bg-gray-50">
                <tr>{['Admin','Role','Status','Country Access','Permissions','Created'].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr>
              </thead>
              <tbody>
                {(admins ?? []).map((admin) => {
                  const countries = (access ?? []).filter((x) => x.user_id === admin.id).map((x) => x.country);
                  const grants = (permissions ?? []).filter((x) => x.user_id === admin.id && x.allowed).length;
                  return (
                    <tr key={admin.id} className="border-b last:border-0">
                      <td className="px-4 py-4"><p className="font-bold">{admin.full_name || 'Unnamed admin'}</p><p className="text-xs text-gray-500">{admin.email || admin.phone || admin.id}</p></td>
                      <td className="px-4 py-4"><span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold">{admin.role}</span></td>
                      <td className="px-4 py-4">{admin.blocked ? 'Blocked' : 'Active'}</td>
                      <td className="px-4 py-4">{admin.role === 'master_admin' ? 'All countries' : countries.length ? countries.join(', ') : 'None'}</td>
                      <td className="px-4 py-4">{admin.role === 'master_admin' ? 'All modules' : `${grants}/${ADMIN_PERMISSION_KEYS.length}`}</td>
                      <td className="px-4 py-4">{new Date(admin.created_at).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-black">Recent Audit Log</h2>
          <div className="mt-5 space-y-3">
            {(auditLogs ?? []).map((log) => (
              <div key={log.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div><p className="font-bold">{log.action}</p><p className="text-xs text-gray-500">{log.entity_type || 'system'}{log.entity_id ? ` · ${log.entity_id}` : ''}</p></div>
                  <time className="text-xs text-gray-500">{log.created_at ? new Date(log.created_at).toLocaleString() : '—'}</time>
                </div>
              </div>
            ))}
            {!auditLogs?.length && <p className="text-sm text-gray-500">No audit events yet.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
