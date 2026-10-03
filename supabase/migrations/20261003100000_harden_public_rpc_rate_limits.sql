-- Public order/track RPC abuse protection.
--
-- Scope:
--   * Public checkout RPCs remain available to anon/authenticated.
--   * Only successful/public order-creation attempts are rate-limited at the
--     orders insert boundary, so service-role/Messenger/admin flows are not
--     affected.
--   * Public order tracking is rate-limited inside track_order().
--
-- Limits:
--   order_create: 5/min, 10/hour, 20/day per normalized phone number.
--   track_order: 10/min, 30/hour, 100/day per normalized phone number.
--
-- This is intentionally DB-side because these SECURITY DEFINER RPCs are
-- directly callable through PostgREST and must not rely only on UI controls.

create table if not exists public.public_rpc_rate_limits (
  operation text not null,
  subject_hash text not null,
  minute_window_at timestamptz not null,
  minute_count integer not null default 0,
  hour_window_at timestamptz not null,
  hour_count integer not null default 0,
  day_window_at timestamptz not null,
  day_count integer not null default 0,
  last_seen_at timestamptz not null default now(),
  primary key (operation, subject_hash)
);

alter table public.public_rpc_rate_limits enable row level security;
alter table public.public_rpc_rate_limits force row level security;

revoke all on table public.public_rpc_rate_limits from public;
revoke all on table public.public_rpc_rate_limits from anon;
revoke all on table public.public_rpc_rate_limits from authenticated;
grant all on table public.public_rpc_rate_limits to service_role;

comment on table public.public_rpc_rate_limits is
  'Internal DB-side rate-limit counters for public SECURITY DEFINER order/track RPCs. Not exposed to API roles.';

create or replace function public.enforce_public_rpc_rate_limit(
  p_operation text,
  p_subject text,
  p_minute_limit integer,
  p_hour_limit integer,
  p_day_limit integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_minute_window timestamptz := date_trunc('minute', v_now);
  v_hour_window timestamptz := date_trunc('hour', v_now);
  v_day_window timestamptz := date_trunc('day', v_now);
  v_subject text;
  v_subject_hash text;
  v_key text;
  v_minute_count integer;
  v_hour_count integer;
  v_day_count integer;
begin
  -- Trigger/function callers that are not public API roles are trusted.
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') then
    return;
  end if;

  if p_operation is null
     or p_operation !~ '^[a-z0-9_]+$'
     or p_minute_limit <= 0
     or p_hour_limit <= 0
     or p_day_limit <= 0 then
    raise exception 'Invalid public RPC rate-limit configuration';
  end if;

  -- Normalize phone-like subjects. For malformed tracking input, fall back
  -- to the trimmed raw subject so invalid attempts can still be throttled.
  v_subject := regexp_replace(coalesce(p_subject, ''), '[^0-9]', '', 'g');
  if v_subject = '' then
    v_subject := lower(btrim(coalesce(p_subject, '')));
  end if;
  if v_subject = '' then
    v_subject := '<missing>';
  end if;

  -- Store only a digest rather than raw customer phone numbers.
  v_subject_hash := md5(v_subject);
  v_key := p_operation || ':' || v_subject_hash;

  -- Serialize concurrent attempts for the same operation+subject.
  perform pg_advisory_xact_lock(hashtextextended(v_key, 0));

  select minute_count, hour_count, day_count
    into v_minute_count, v_hour_count, v_day_count
  from public.public_rpc_rate_limits
  where operation = p_operation
    and subject_hash = v_subject_hash
  for update;

  if not found then
    insert into public.public_rpc_rate_limits (
      operation,
      subject_hash,
      minute_window_at,
      minute_count,
      hour_window_at,
      hour_count,
      day_window_at,
      day_count,
      last_seen_at
    )
    values (
      p_operation,
      v_subject_hash,
      v_minute_window,
      0,
      v_hour_window,
      0,
      v_day_window,
      0,
      v_now
    );

    v_minute_count := 0;
    v_hour_count := 0;
    v_day_count := 0;
  else
    if (select minute_window_at from public.public_rpc_rate_limits
        where operation = p_operation and subject_hash = v_subject_hash) <> v_minute_window then
      v_minute_count := 0;
    end if;

    if (select hour_window_at from public.public_rpc_rate_limits
        where operation = p_operation and subject_hash = v_subject_hash) <> v_hour_window then
      v_hour_count := 0;
    end if;

    if (select day_window_at from public.public_rpc_rate_limits
        where operation = p_operation and subject_hash = v_subject_hash) <> v_day_window then
      v_day_count := 0;
    end if;
  end if;

  if v_minute_count >= p_minute_limit
     or v_hour_count >= p_hour_limit
     or v_day_count >= p_day_limit then
    raise exception 'Too many requests. Please try again later.';
  end if;

  update public.public_rpc_rate_limits
  set minute_window_at = v_minute_window,
      minute_count = case when minute_window_at = v_minute_window then minute_count + 1 else 1 end,
      hour_window_at = v_hour_window,
      hour_count = case when hour_window_at = v_hour_window then hour_count + 1 else 1 end,
      day_window_at = v_day_window,
      day_count = case when day_window_at = v_day_window then day_count + 1 else 1 end,
      last_seen_at = v_now
  where operation = p_operation
    and subject_hash = v_subject_hash;
end;
$function$;

revoke all on function public.enforce_public_rpc_rate_limit(text,text,integer,integer,integer)
  from public, anon, authenticated;
grant execute on function public.enforce_public_rpc_rate_limit(text,text,integer,integer,integer)
  to service_role;

create or replace function public.guard_public_order_create_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if auth.role() in ('anon', 'authenticated') then
    perform public.enforce_public_rpc_rate_limit(
      'order_create',
      new.customer_phone,
      5,
      10,
      20
    );
  end if;

  return new;
end;
$function$;

revoke all on function public.guard_public_order_create_rate_limit()
  from public, anon, authenticated;
grant execute on function public.guard_public_order_create_rate_limit()
  to service_role;

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
set search_path = public, pg_temp
as $function$
declare
  v_order jsonb;
  v_items jsonb;
begin
  -- Prevent brute-force tracking attempts against the public RPC while
  -- retaining normal public tracking access.
  perform public.enforce_public_rpc_rate_limit(
    'track_order',
    p_customer_phone,
    10,
    30,
    100
  );

  -- Reject obviously oversized input before touching the orders table.
  if length(coalesce(p_order_number, '')) > 64
     or length(coalesce(p_customer_phone, '')) > 32 then
    return null;
  end if;

  select jsonb_build_object(
    'id', o.id,
    'order_number', o.order_number,
    'customer_name', o.customer_name,
    'customer_phone', o.customer_phone,
    'delivery_address', o.delivery_address,
    'delivery_zone_name', o.delivery_zone_name,
    'delivery_charge', o.delivery_charge,
    'subtotal', o.subtotal,
    'discount', o.discount,
    'grand_total', o.grand_total,
    'payment_method', o.payment_method,
    'order_source', o.order_source,
    'status', o.status,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'payment_status', o.payment_status,
    'landing_page_id', o.landing_page_id,
    'district', o.district,
    'thana', o.thana,
    'order_status', o.order_status,
    'shipping_fee', o.shipping_fee,
    'quantity_selected', o.quantity_selected,
    'wallet_credit_used', o.wallet_credit_used
  )
  into v_order
  from public.orders o
  where upper(trim(o.order_number)) = upper(trim(p_order_number))
    and regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g') =
        regexp_replace(coalesce(p_customer_phone, ''), '[^0-9]', '', 'g')
  limit 1;

  if v_order is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', oi.id,
        'order_id', oi.order_id,
        'product_id', oi.product_id,
        'product_name', oi.product_name,
        'quantity', oi.quantity,
        'unit_price', oi.unit_price,
        'total_price', oi.total_price,
        'bundle_id', oi.bundle_id,
        'bundle_name', oi.bundle_name,
        'image', oi.image,
        'created_at', oi.created_at,
        'variant_id', oi.variant_id
      )
      order by oi.created_at
    ),
    '[]'::jsonb
  )
  into v_items
  from public.order_items oi
  where oi.order_id = (v_order->>'id')::uuid;

  return jsonb_build_object('order', v_order, 'items', v_items);
end;
$function$;

revoke all on function public.track_order(text,text)
  from public;
grant execute on function public.track_order(text,text)
  to anon, authenticated, service_role;

comment on function public.enforce_public_rpc_rate_limit(text,text,integer,integer,integer) is
  'Internal DB-side sliding-window counters for public order/track RPC abuse protection.';
comment on function public.guard_public_order_create_rate_limit() is
  'Before-insert guard that rate-limits public order creation by normalized customer phone.';
