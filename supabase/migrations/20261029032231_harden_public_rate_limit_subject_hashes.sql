-- Replace guessable phone/IP digests with a per-database secret HMAC.
-- Existing short-lived 32-character digests remain valid until cleanup.

create table if not exists private.public_rpc_rate_limit_secret (
  singleton boolean primary key default true check (singleton),
  key_material bytea not null check (octet_length(key_material) = 32),
  created_at timestamptz not null default clock_timestamp()
);

alter table private.public_rpc_rate_limit_secret enable row level security;
revoke all on table private.public_rpc_rate_limit_secret from public, anon, authenticated, service_role;

insert into private.public_rpc_rate_limit_secret(singleton, key_material)
values (true, extensions.gen_random_bytes(32))
on conflict (singleton) do nothing;

alter table private.public_rpc_rate_limits
  drop constraint if exists public_rpc_rate_limits_subject_hash_check;
alter table private.public_rpc_rate_limits
  add constraint public_rpc_rate_limits_subject_hash_check
  check (subject_hash ~ '^([0-9a-f]{32}|[0-9a-f]{64})$');

create or replace function private.public_rpc_rate_limit_hash(p_subject text)
returns text
language sql
stable
security definer
set search_path = pg_catalog, private, extensions, pg_temp
as $function$
  select encode(extensions.hmac(convert_to(p_subject, 'UTF8'), s.key_material, 'sha256'), 'hex')
  from private.public_rpc_rate_limit_secret s
  where s.singleton = true;
$function$;

revoke all on function private.public_rpc_rate_limit_hash(text) from public, anon, authenticated, service_role;

create or replace function private.consume_public_rpc_rate_limit(
  p_operation text,
  p_subject_kind text,
  p_subject text,
  p_minute_limit integer,
  p_hour_limit integer,
  p_day_limit integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private, pg_temp
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_minute_window timestamptz := date_trunc('minute', v_now);
  v_hour_window timestamptz := date_trunc('hour', v_now);
  v_day_window timestamptz := date_trunc('day', v_now);
  v_subject text;
  v_subject_hash text;
  v_lock_key text;
  v_minute_count integer;
  v_hour_count integer;
  v_day_count integer;
  v_minute_window_at timestamptz;
  v_hour_window_at timestamptz;
  v_day_window_at timestamptz;
begin
  if p_operation not in ('order_create', 'track_order')
     or p_subject_kind not in ('phone', 'ip')
     or p_minute_limit <= 0
     or p_hour_limit <= 0
     or p_day_limit <= 0 then
    raise exception 'Invalid public RPC rate-limit configuration';
  end if;

  if p_subject_kind = 'phone' then
    v_subject := regexp_replace(coalesce(p_subject, ''), '[^0-9]', '', 'g');
  else
    begin
      v_subject := host(p_subject::inet);
    exception when others then
      return;
    end;
  end if;

  if v_subject is null or v_subject = '' then
    return;
  end if;

  v_subject_hash := private.public_rpc_rate_limit_hash(v_subject);
  v_lock_key := p_operation || ':' || p_subject_kind || ':' || v_subject_hash;
  perform pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  select minute_window_at, minute_count,
         hour_window_at, hour_count,
         day_window_at, day_count
    into v_minute_window_at, v_minute_count,
         v_hour_window_at, v_hour_count,
         v_day_window_at, v_day_count
  from private.public_rpc_rate_limits
  where operation = p_operation
    and subject_kind = p_subject_kind
    and subject_hash = v_subject_hash
  for update;

  if not found then
    insert into private.public_rpc_rate_limits (
      operation, subject_kind, subject_hash,
      minute_window_at, minute_count,
      hour_window_at, hour_count,
      day_window_at, day_count, last_seen_at
    ) values (
      p_operation, p_subject_kind, v_subject_hash,
      v_minute_window, 1,
      v_hour_window, 1,
      v_day_window, 1, v_now
    );
    return;
  end if;

  v_minute_count := case when v_minute_window_at = v_minute_window then v_minute_count else 0 end;
  v_hour_count := case when v_hour_window_at = v_hour_window then v_hour_count else 0 end;
  v_day_count := case when v_day_window_at = v_day_window then v_day_count else 0 end;

  if v_minute_count >= p_minute_limit
     or v_hour_count >= p_hour_limit
     or v_day_count >= p_day_limit then
    raise sqlstate 'PGRST' using
      message = jsonb_build_object(
        'message', 'Too many attempts. Please wait and try again.',
        'code', 'PUBLIC_RPC_RATE_LIMIT'
      )::text,
      detail = jsonb_build_object(
        'status', 429,
        'status_text', 'Too Many Requests'
      )::text;
  end if;

  update private.public_rpc_rate_limits
  set minute_window_at = v_minute_window,
      minute_count = v_minute_count + 1,
      hour_window_at = v_hour_window,
      hour_count = v_hour_count + 1,
      day_window_at = v_day_window,
      day_count = v_day_count + 1,
      last_seen_at = v_now
  where operation = p_operation
    and subject_kind = p_subject_kind
    and subject_hash = v_subject_hash;
end;
$function$;
