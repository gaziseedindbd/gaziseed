-- Run after applying the two forward migrations in a test database.
DO $$
BEGIN
  IF to_regclass('public.public_rpc_rate_limits') IS NULL THEN
    RAISE EXCEPTION 'FAIL: public RPC rate-limit table is missing';
  END IF;
  IF has_table_privilege('anon', 'public.public_rpc_rate_limits', 'SELECT')
     OR has_table_privilege('authenticated', 'public.public_rpc_rate_limits', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: client roles can read public RPC rate-limit counters';
  END IF;
  IF has_function_privilege('anon', 'public.enforce_public_rpc_rate_limit(text,text,integer,integer,integer)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.enforce_public_rpc_rate_limit(text,text,integer,integer,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: client roles can directly execute the internal rate limiter';
  END IF;
  IF NOT has_function_privilege('anon', 'public.track_order(text,text)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.track_order(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: normal public tracking RPC access was removed';
  END IF;
  IF position('enforce_public_rpc_rate_limit' IN pg_get_functiondef('public.track_order(text,text)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'FAIL: track_order does not invoke the internal rate limiter';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='orders'
      AND t.tgname='aa_guard_public_order_create_rate_limit' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'FAIL: public order-create rate-limit trigger is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ai_settings WHERE is_enabled IS TRUE AND api_key_secret_id IS NULL) THEN
    RAISE EXCEPTION 'FAIL: AI settings remain enabled without a Vault secret reference';
  END IF;
END
$$;
