-- Restore the browser RPC entry point; authorization remains inside the existing function.
DO $check$
BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_proc p
  WHERE p.oid='public.collect_cod_due_atomic(uuid)'::regprocedure
   AND p.prosecdef AND pg_get_userbyid(p.proowner)='postgres'
   AND md5(pg_get_functiondef(p.oid))='12da1672d2ed75ec1d577f1e5389b313'
 ) THEN
  RAISE EXCEPTION 'COD settlement function changed; review before restoring execute';
 END IF;
END;
$check$;
REVOKE EXECUTE ON FUNCTION public.collect_cod_due_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.collect_cod_due_atomic(uuid) TO authenticated;
