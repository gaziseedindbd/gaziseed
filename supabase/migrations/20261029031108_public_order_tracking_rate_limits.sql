-- Database-side throttling for public checkout inserts and public tracking RPCs.
-- The counters live in a non-API schema and contain only short-lived digests.

create schema if not exists private;

create table if not exists private.public_rpc_rate_limits (
  operation text not null check (operation in ('order_create', 'track_order')),
  subject_kind text not null check (subject_kind in ('phone', 'ip')),
  subject_hash text not null check (subject_hash ~ '^[0-9a-f]{32}$'),
  minute_window_at timestamptz not null,
  minute_count integer not null default 0 check (minute_count >= 0),
  hour_window_at timestamptz not null,
  hour_count integer not null default 0 check (hour_count >= 0),
  day_window_at timestamptz not null,
  day_count integer not null default 0 check (day_count >= 0),
  last_seen_at timestamptz not null default clock_timestamp(),
  primary key (operation, subject_kind, subject_hash)
);

create index if not exists public_rpc_rate_limits_last_seen_idx
  on private.public_rpc_rate_limits (last_seen_at);

alter table private.public_rpc_rate_limits enable row level security;
revoke all on table private.public_rpc_rate_limits from public, anon, authenticated, service_role;

comment on table private.public_rpc_rate_limits is
  'Short-lived, private counters for public order creation and tracking rate limits.';

create or replace function private.current_request_ip()
returns inet
language plpgsql
stable
security definer
set search_path = pg_catalog, private, pg_temp
as $function$
declare
  v_headers jsonb;
  v_forwarded text;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;

  if v_headers is null then
    return null;
  end if;

  -- Supabase's Data API forwards the originating address in X-Forwarded-For.
  v_forwarded := split_part(coalesce(v_headers->>'x-forwarded-for', v_headers->>'cf-connecting-ip', ''), ',', 1);
  v_forwarded := nullif(btrim(v_forwarded), '');
  if v_forwarded is null then
    return null;
  end if;

  begin
    return v_forwarded::inet;
  exception when others then
    return null;
  end;
end;
$function$;

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

  -- Invalid/empty phone input is still covered by the IP bucket when present.
  if v_subject is null or v_subject = '' then
    return;
  end if;

  v_subject_hash := md5(v_subject);
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

create or replace function private.enforce_public_rpc_rate_limit(
  p_operation text,
  p_phone text,
  p_client_ip inet default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, private, pg_temp
as $function$
declare
  v_digits text;
begin
  if length(coalesce(p_phone, '')) <= 32 then
    v_digits := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  else
    v_digits := '';
  end if;

  if p_operation = 'order_create' then
    if v_digits <> '' then
      perform private.consume_public_rpc_rate_limit('order_create', 'phone', v_digits, 5, 10, 20);
    end if;
    if p_client_ip is not null then
      perform private.consume_public_rpc_rate_limit('order_create', 'ip', host(p_client_ip), 20, 60, 200);
    end if;
  elsif p_operation = 'track_order' then
    if p_client_ip is not null then
      perform private.consume_public_rpc_rate_limit('track_order', 'ip', host(p_client_ip), 30, 120, 600);
    end if;
    if v_digits <> '' then
      perform private.consume_public_rpc_rate_limit('track_order', 'phone', v_digits, 10, 30, 100);
    end if;
  else
    raise exception 'Invalid public RPC rate-limit operation';
  end if;
end;
$function$;

create or replace function private.cleanup_public_rpc_rate_limits()
returns void
language sql
security definer
set search_path = pg_catalog, private, pg_temp
as $function$
  delete from private.public_rpc_rate_limits
  where last_seen_at < clock_timestamp() - interval '48 hours';
$function$;

revoke all on function private.current_request_ip() from public, anon, authenticated, service_role;
revoke all on function private.consume_public_rpc_rate_limit(text, text, text, integer, integer, integer) from public, anon, authenticated, service_role;
revoke all on function private.enforce_public_rpc_rate_limit(text, text, inet) from public, anon, authenticated, service_role;
revoke all on function private.cleanup_public_rpc_rate_limits() from public, anon, authenticated, service_role;

create or replace function public.guard_public_order_create_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $function$
begin
  if coalesce(auth.jwt()->>'role', '') in ('anon', 'authenticated') then
    perform private.enforce_public_rpc_rate_limit(
      'order_create',
      new.customer_phone,
      private.current_request_ip()
    );
  end if;
  return new;
end;
$function$;

revoke all on function public.guard_public_order_create_rate_limit() from public, anon, authenticated, service_role;
drop trigger if exists aa_guard_public_order_create_rate_limit on public.orders;
create trigger aa_guard_public_order_create_rate_limit
before insert on public.orders
for each row
execute function public.guard_public_order_create_rate_limit();

create or replace function public.track_order(
  p_order_number text,
  p_customer_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $function$
declare
  v_order_id uuid;
  v_order jsonb;
  v_items jsonb;
  v_role text := coalesce(auth.jwt()->>'role', '');
  v_phone_digits text;
begin
  -- Count every public attempt by IP, including oversized/malformed input.
  if v_role in ('anon', 'authenticated') then
    perform private.enforce_public_rpc_rate_limit(
      'track_order',
      null,
      private.current_request_ip()
    );
  end if;

  if length(coalesce(p_order_number, '')) > 64
     or length(coalesce(p_customer_phone, '')) > 32 then
    return null;
  end if;

  v_phone_digits := regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g');

  -- Also limit attempts per normalized phone so changing IPs does not bypass it.
  if v_role in ('anon', 'authenticated') and v_phone_digits <> '' then
    perform private.enforce_public_rpc_rate_limit(
      'track_order',
      v_phone_digits,
      null
    );
  end if;

  select o.id, jsonb_build_object(
    'order_number', o.order_number,
    'customer_name', o.customer_name,
    'customer_phone', case
      when length(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g')) >= 4
        then repeat('•', length(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g')) - 4)
             || right(regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g'), 4)
      else '••••'
    end,
    'delivery_zone_name', o.delivery_zone_name,
    'delivery_charge', o.delivery_charge,
    'subtotal', o.subtotal,
    'discount', o.discount,
    'grand_total', o.grand_total,
    'status', o.status,
    'created_at', o.created_at,
    'district', o.district,
    'thana', o.thana
  )
  into v_order_id, v_order
  from public.orders o
  where o.order_number = upper(trim(p_order_number))
    and regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g') = v_phone_digits
  limit 1;

  if v_order is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'image', to_jsonb(oi)->>'image'
      )
      order by coalesce(nullif(to_jsonb(oi)->>'created_at', '')::timestamptz, 'epoch'::timestamptz), oi.id
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items oi
  where oi.order_id = v_order_id;

  return jsonb_build_object('order', v_order, 'items', v_items);
end;
$function$;

revoke all on function public.track_order(text, text) from public;
grant execute on function public.track_order(text, text) to anon, authenticated, service_role;

comment on function private.enforce_public_rpc_rate_limit(text, text, inet) is
  'Internal fixed-window IP and normalized-phone throttling for public order creation and tracking.';
comment on function public.track_order(text, text) is
  'Public order tracking with IP/phone throttling and a privacy-minimized response.';

-- Install a bounded retention job when pg_cron is already enabled. Do not
-- enable a new extension as part of this change.
do $schedule$
declare
  v_existing_job_count integer;
begin
  if to_regclass('cron.job') is not null
     and to_regprocedure('cron.schedule(text, text, text)') is not null then
    execute 'select count(*) from cron.job where jobname = $1'
      into v_existing_job_count
      using 'cleanup_public_rpc_rate_limits';
    if v_existing_job_count = 0 then
      execute 'select cron.schedule($1, $2, $3)'
        using 'cleanup_public_rpc_rate_limits', '*/15 * * * *',
              'select private.cleanup_public_rpc_rate_limits()';
    end if;
  end if;
end;
$schedule$;
