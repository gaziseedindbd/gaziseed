import 'server-only';

import { createClient } from '@/lib/supabase/server';

export const ADMIN_PERMISSION_KEYS = [
  'products.read',
  'products.write',
  'orders.read',
  'orders.write',
  'inventory.read',
  'inventory.write',
  'customers.read',
  'customers.write',
  'coupons.read',
  'coupons.write',
  'content.read',
  'content.write',
  'reports.read',
  'settings.write',
] as const;

export type AdminPermissionKey = typeof ADMIN_PERMISSION_KEYS[number];

export async function getCurrentAdminContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,full_name,email,role,blocked,preferred_country,language')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || profile.blocked || !['admin', 'master_admin'].includes(profile.role)) return null;

  const [{ data: countries }, { data: permissions }] = await Promise.all([
    supabase.from('admin_country_access').select('country').eq('user_id', user.id),
    supabase.from('admin_permissions').select('permission_key,allowed').eq('user_id', user.id),
  ]);

  return {
    user,
    profile,
    countries: countries ?? [],
    permissions: permissions ?? [],
  };
}

export function hasPermission(context: Awaited<ReturnType<typeof getCurrentAdminContext>>, key: AdminPermissionKey) {
  if (!context) return false;
  if (context.profile.role === 'master_admin') return true;
  return context.permissions.some((permission) => permission.permission_key === key && permission.allowed);
}
