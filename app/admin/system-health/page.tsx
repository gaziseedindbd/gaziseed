import { createClient } from '@/lib/supabase/server';
import { SEED_BARI_MODULES } from '@/lib/seed-bari/config';

const CHECKS = [
  ['countries', 'Country engine'],
  ['products', 'Products'],
  ['product_variants', 'Variants'],
  ['inventory_movements', 'Inventory'],
  ['combos', 'Combos'],
  ['coupons', 'Coupons'],
  ['campaigns', 'Campaigns'],
  ['referral_settings', 'Referrals'],
  ['reward_settings', 'Rewards'],
  ['reviews', 'Reviews'],
  ['support_tickets', 'Support'],
  ['content_pages', 'CMS pages'],
  ['banners', 'Banners'],
  ['payment_transactions', 'Payments'],
  ['audit_logs', 'Audit logs'],
] as const;

export default async function SystemHealthPage() {
  const supabase = await createClient();
  const results = await Promise.all(
    CHECKS.map(async ([table, label]) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      return { table, label, count: count ?? 0, ok: !error, error: error?.message ?? null };
    }),
  );

  const healthy = results.filter((item) => item.ok).length;

  return (
    <main className="p-5 md:p-8">
      <div className="max-w-5xl">
        <p className="font-bold text-[#1f6b3b]">SEED BARI</p>
        <h1 className="mt-1 text-3xl font-black">System Health</h1>
        <p className="mt-2 text-gray-500">
          Integration checkpoint for the unified India + Bangladesh commerce platform.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-gray-500">Database checks</p>
            <p className="mt-2 text-3xl font-black">{healthy}/{results.length}</p>
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-gray-500">Target modules</p>
            <p className="mt-2 text-3xl font-black">{SEED_BARI_MODULES.length}</p>
          </div>
          <div className="rounded-2xl border bg-white p-5">
            <p className="text-sm text-gray-500">Overall status</p>
            <p className="mt-2 text-3xl font-black">{healthy === results.length ? 'Healthy' : 'Review'}</p>
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border bg-white">
          <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b px-5 py-4 text-sm font-bold text-gray-500">
            <div>Module</div>
            <div>Rows</div>
            <div>Status</div>
          </div>
          {results.map((item) => (
            <div key={item.table} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b px-5 py-4 last:border-b-0">
              <div>
                <p className="font-semibold">{item.label}</p>
                <p className="text-xs text-gray-400">{item.table}</p>
              </div>
              <div className="font-mono text-sm">{item.count}</div>
              <div className={item.ok ? 'font-semibold text-green-700' : 'font-semibold text-red-700'}>
                {item.ok ? 'OK' : 'ERROR'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
