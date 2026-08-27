-- Enforce the intended single MASTER_ADMIN hierarchy at the database level.
-- Existing production data currently contains exactly one MASTER_ADMIN.
-- This prevents a second MASTER_ADMIN from being created or promoted,
-- including through service-role paths that bypass RLS.

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_single_master_admin_idx
  ON public.admin_users (role)
  WHERE role = 'master_admin';
