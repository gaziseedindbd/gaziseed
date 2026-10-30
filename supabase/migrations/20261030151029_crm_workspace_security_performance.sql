-- Keep CRM data unavailable to the anonymous API role even if table grants
-- change later. Authenticated Admin access remains branch-scoped by RLS.
REVOKE ALL ON TABLE
  public.crm_customer_notes,
  public.crm_customer_tags,
  public.crm_follow_up_tasks,
  public.crm_saved_segments
FROM anon, PUBLIC;

GRANT SELECT, INSERT ON TABLE public.crm_customer_notes TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.crm_customer_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_follow_up_tasks TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.crm_saved_segments TO authenticated;

DROP POLICY IF EXISTS crm_customer_notes_branch_insert ON public.crm_customer_notes;
CREATE POLICY crm_customer_notes_branch_insert
  ON public.crm_customer_notes FOR INSERT TO authenticated
  WITH CHECK (public.can_access_country(country_code) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS crm_customer_tags_branch_access ON public.crm_customer_tags;
CREATE POLICY crm_customer_tags_branch_access
  ON public.crm_customer_tags FOR ALL TO authenticated
  USING (public.can_access_country(country_code))
  WITH CHECK (public.can_access_country(country_code) AND created_by = (SELECT auth.uid()));

DROP POLICY IF EXISTS crm_follow_up_tasks_branch_access ON public.crm_follow_up_tasks;
CREATE POLICY crm_follow_up_tasks_branch_access
  ON public.crm_follow_up_tasks FOR ALL TO authenticated
  USING (public.can_access_country(country_code))
  WITH CHECK (
    public.can_access_country(country_code)
    AND created_by = (SELECT auth.uid())
    AND (assigned_to IS NULL OR assigned_to = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS crm_saved_segments_branch_access ON public.crm_saved_segments;
CREATE POLICY crm_saved_segments_branch_access
  ON public.crm_saved_segments FOR ALL TO authenticated
  USING (public.can_access_country(country_code))
  WITH CHECK (public.can_access_country(country_code) AND created_by = (SELECT auth.uid()));

CREATE INDEX IF NOT EXISTS idx_crm_customer_notes_created_by
  ON public.crm_customer_notes(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_customer_tags_created_by
  ON public.crm_customer_tags(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_follow_up_tasks_assigned_to
  ON public.crm_follow_up_tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_follow_up_tasks_created_by
  ON public.crm_follow_up_tasks(created_by) WHERE created_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_saved_segments_created_by
  ON public.crm_saved_segments(created_by) WHERE created_by IS NOT NULL;
