-- Add secure branch-local task assignment helpers for the CRM.
-- Staff can see the active teammates for their current branch without
-- exposing the full admin directory, and only active same-branch admins
-- can be assigned a follow-up task.
CREATE OR REPLACE FUNCTION public.crm_branch_admins()
RETURNS TABLE(user_id uuid, display_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT
    a.user_id,
    coalesce(nullif(btrim(a.full_name), ''), nullif(btrim(a.name), ''), nullif(btrim(a.email), ''), 'Admin') AS display_name
  FROM public.admin_users AS a
  WHERE (SELECT public.is_admin())
    AND a.is_active
    AND (
      upper(coalesce(a.country_code, '')) = (SELECT public.current_admin_country())
      OR (a.user_id = (SELECT auth.uid()) AND a.role = 'master_admin'
          AND (SELECT public.can_access_country(public.current_admin_country())))
    )
  ORDER BY display_name;
$$;

CREATE OR REPLACE FUNCTION public.crm_is_valid_task_assignee(p_user_id uuid, p_country_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT coalesce(
    (SELECT auth.uid()) IS NOT NULL
    AND (SELECT public.is_admin())
    AND (SELECT public.can_access_country(p_country_code))
    AND EXISTS (
      SELECT 1
      FROM public.admin_users AS a
      WHERE a.user_id = p_user_id
        AND a.is_active
        AND (
          upper(coalesce(a.country_code, '')) = upper(coalesce(p_country_code, ''))
          OR (a.user_id = (SELECT auth.uid()) AND a.role = 'master_admin')
        )
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.crm_branch_admins() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.crm_is_valid_task_assignee(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_branch_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.crm_is_valid_task_assignee(uuid, text) TO authenticated;

ALTER TABLE public.crm_follow_up_tasks
  DROP CONSTRAINT IF EXISTS crm_follow_up_tasks_check;

DROP POLICY IF EXISTS crm_follow_up_tasks_branch_access ON public.crm_follow_up_tasks;
DROP POLICY IF EXISTS crm_follow_up_tasks_branch_read ON public.crm_follow_up_tasks;
DROP POLICY IF EXISTS crm_follow_up_tasks_branch_insert ON public.crm_follow_up_tasks;
DROP POLICY IF EXISTS crm_follow_up_tasks_branch_update ON public.crm_follow_up_tasks;

CREATE POLICY crm_follow_up_tasks_branch_read
  ON public.crm_follow_up_tasks FOR SELECT TO authenticated
  USING (public.can_access_country(country_code));

CREATE POLICY crm_follow_up_tasks_branch_insert
  ON public.crm_follow_up_tasks FOR INSERT TO authenticated
  WITH CHECK (
    public.can_access_country(country_code)
    AND created_by = (SELECT auth.uid())
    AND (assigned_to IS NULL OR public.crm_is_valid_task_assignee(assigned_to, country_code))
  );

CREATE POLICY crm_follow_up_tasks_branch_update
  ON public.crm_follow_up_tasks FOR UPDATE TO authenticated
  USING (
    public.can_access_country(country_code)
    AND (created_by = (SELECT auth.uid()) OR assigned_to = (SELECT auth.uid()))
  )
  WITH CHECK (
    public.can_access_country(country_code)
    AND (
      assigned_to IS NULL
      OR assigned_to = (SELECT auth.uid())
      OR created_by = (SELECT auth.uid())
      OR public.crm_is_valid_task_assignee(assigned_to, country_code)
    )
  );

REVOKE ALL ON TABLE public.crm_follow_up_tasks FROM anon, PUBLIC, authenticated;
GRANT SELECT ON TABLE public.crm_follow_up_tasks TO authenticated;
GRANT INSERT (country_code, customer_key, title, description, due_at, priority, assigned_to, created_by)
  ON TABLE public.crm_follow_up_tasks TO authenticated;
GRANT UPDATE (status, updated_at, assigned_to)
  ON TABLE public.crm_follow_up_tasks TO authenticated;

CREATE INDEX IF NOT EXISTS idx_crm_follow_up_tasks_branch_assignee_due
  ON public.crm_follow_up_tasks(country_code, assigned_to, due_at)
  WHERE status = 'open';
