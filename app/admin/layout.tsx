import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SEED_BARI_BRAND } from '@/lib/seed-bari/config';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await createClient();
  const { data: { user } } = await s.auth.getUser();
  if (!user) redirect('/auth');
  const { data: p } = await s.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!p || !['admin', 'master_admin'].includes(p.role)) redirect('/');

  return (
    <div className="min-h-screen bg-[#f5f7f3] md:flex">
      <aside className="w-full border-b bg-white p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="text-2xl font-black text-[#1f6b3b]">{SEED_BARI_BRAND.shortName}</div>
        <p className="mt-1 text-xs font-semibold text-gray-500">ADMIN PANEL</p>
        <nav className="mt-8 grid gap-2 text-sm font-semibold">
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin">Dashboard</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/products">Products</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/orders">Orders</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/inventory">Inventory</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/inventory/out-of-stock">Out of Stock</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/inventory/low-stock">Low Stock</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/inventory/history">Inventory History</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/combos">Combo Packs</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/customers">Customers</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/categories">Categories</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/coupons">Coupons</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/shipping">Shipping</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/cms">CMS & Marketing</Link>
          <Link className="rounded-xl px-4 py-3 hover:bg-[#edf5e9]" href="/admin/system-health">System Health</Link>
          {p.role === 'master_admin' && (
            <Link className="rounded-xl border border-[#1f6b3b] bg-[#edf5e9] px-4 py-3 font-black text-[#1f6b3b]" href="/admin/master-admin">Master Admin</Link>
          )}
        </nav>
      </aside>
      <section className="flex-1">{children}</section>
    </div>
  );
}
