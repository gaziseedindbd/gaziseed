/*
# Fix is_admin and is_master_admin search_path

## Summary
Sets a locked search_path on the is_admin() and is_master_admin() SECURITY
DEFINER functions. The Supabase database linter flagged both as having a
mutable search_path, which can cause "Database error querying schema" when
the RPC is invoked from the anon-key client.

## Details
1. Recreate is_admin() with `SET search_path = public, extensions` so the
   internal query against admin_users resolves deterministically.
2. Recreate is_master_admin() with the same locked search_path.

## Security
- No data changes. No policy changes. Only function definitions updated.
- Both functions remain SECURITY DEFINER, STABLE, owned by postgres.
- Execute privileges are preserved (granted to anon and authenticated).
*/

-- 1. Fix is_admin() search_path
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid() AND is_active = true
  );
$$;

-- 2. Fix is_master_admin() search_path
CREATE OR REPLACE FUNCTION public.is_master_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users
    WHERE user_id = auth.uid() AND is_active = true AND role = 'master_admin'
  );
$$;

-- 3. Re-grant execute to anon and authenticated (preserved after recreate)
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_master_admin() TO anon, authenticated;
