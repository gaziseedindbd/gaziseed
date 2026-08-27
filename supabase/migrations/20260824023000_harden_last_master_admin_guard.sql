-- Prevent the last active MASTER_ADMIN from being disabled, demoted, or deleted.
-- The advisory transaction lock makes the check atomic under concurrent requests.

CREATE OR REPLACE FUNCTION public.guard_last_master_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_master_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'master_admin' AND OLD.is_active = true THEN
      PERFORM pg_advisory_xact_lock(hashtext('seedbari:last_active_master_admin'));

      SELECT count(*)
        INTO active_master_count
      FROM public.admin_users
      WHERE role = 'master_admin'
        AND is_active = true;

      IF active_master_count <= 1 THEN
        RAISE EXCEPTION 'Cannot remove the last active MASTER_ADMIN. At least one must remain active.';
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  IF OLD.role = 'master_admin'
     AND OLD.is_active = true
     AND (NEW.role IS DISTINCT FROM 'master_admin' OR NEW.is_active IS DISTINCT FROM true) THEN
    PERFORM pg_advisory_xact_lock(hashtext('seedbari:last_active_master_admin'));

    SELECT count(*)
      INTO active_master_count
    FROM public.admin_users
    WHERE role = 'master_admin'
      AND is_active = true;

    IF active_master_count <= 1 THEN
      RAISE EXCEPTION 'Cannot disable or demote the last active MASTER_ADMIN. At least one must remain active.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_last_master_admin_before_change ON public.admin_users;

CREATE TRIGGER guard_last_master_admin_before_change
BEFORE UPDATE OR DELETE ON public.admin_users
FOR EACH ROW
EXECUTE FUNCTION public.guard_last_master_admin();

REVOKE ALL ON FUNCTION public.guard_last_master_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_last_master_admin() TO service_role;
