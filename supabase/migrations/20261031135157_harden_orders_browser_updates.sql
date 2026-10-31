-- Browser sessions can read only rows allowed by the existing SELECT policies.
-- All supported order writes go through branch-checked SECURITY DEFINER RPCs
-- or trusted service-role functions; do not expose table-wide UPDATE access.
REVOKE UPDATE ON TABLE public.orders FROM authenticated;

DROP POLICY IF EXISTS orders_admin_branch_update ON public.orders;
