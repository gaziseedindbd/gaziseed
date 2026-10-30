-- Remove inherited or earlier broad table grants before restoring only the
-- operations required by the CRM UI. RLS continues to scope rows by branch.
REVOKE ALL ON TABLE
  public.crm_customer_notes,
  public.crm_customer_tags,
  public.crm_follow_up_tasks,
  public.crm_saved_segments
FROM anon, PUBLIC, authenticated;

GRANT SELECT, INSERT ON TABLE public.crm_customer_notes TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.crm_customer_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.crm_follow_up_tasks TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.crm_saved_segments TO authenticated;
