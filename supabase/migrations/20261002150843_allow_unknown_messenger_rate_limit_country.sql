ALTER TABLE public.messenger_rate_limits
  DROP CONSTRAINT IF EXISTS messenger_rate_limits_country_code_check;

ALTER TABLE public.messenger_rate_limits
  ADD CONSTRAINT messenger_rate_limits_country_code_check
  CHECK (country_code = ANY (ARRAY['IN'::text, 'BD'::text, 'UNKNOWN'::text]));

CREATE OR REPLACE FUNCTION public.consume_messenger_rate_limit(
  p_page_id text,
  p_external_user_id text,
  p_country_code text,
  p_message_hash text DEFAULT NULL::text,
  p_mode text DEFAULT 'message'::text
)
RETURNS TABLE(
  allowed boolean,
  reason text,
  retry_after_seconds integer,
  notify_customer boolean,
  minute_count integer,
  hour_count integer,
  day_count integer,
  ai_minute_count integer,
  ai_hour_count integer,
  duplicate_count integer,
  blocked_until timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
declare
  v_now timestamptz := now();
  v_row public.messenger_rate_limits;
  v_message_allowed boolean := true;
  v_ai_allowed boolean := true;
  v_reason text := null;
  v_retry integer := 0;
  v_notify boolean := false;
begin
  if p_page_id is null or btrim(p_page_id) = '' then
    raise exception 'Messenger page id is required';
  end if;

  if p_external_user_id is null or btrim(p_external_user_id) = '' then
    raise exception 'Messenger external user id is required';
  end if;

  if p_country_code not in ('IN', 'BD', 'UNKNOWN') then
    raise exception 'Unsupported Messenger country code';
  end if;

  if p_mode not in ('message', 'ai') then
    raise exception 'Unsupported Messenger rate-limit mode';
  end if;

  insert into public.messenger_rate_limits (
    page_id,
    external_user_id,
    country_code
  )
  values (
    p_page_id,
    p_external_user_id,
    p_country_code
  )
  on conflict (page_id, external_user_id)
  do nothing;

  select *
    into v_row
    from public.messenger_rate_limits
   where page_id = p_page_id
     and external_user_id = p_external_user_id
   for update;

  if v_row.country_code is distinct from p_country_code then
    v_row.country_code := p_country_code;
  end if;

  if v_row.minute_window_at < date_trunc('minute', v_now) then
    v_row.minute_window_at := date_trunc('minute', v_now);
    v_row.minute_count := 0;
  end if;

  if v_row.hour_window_at < date_trunc('hour', v_now) then
    v_row.hour_window_at := date_trunc('hour', v_now);
    v_row.hour_count := 0;
  end if;

  if v_row.day_window_at < date_trunc('day', v_now) then
    v_row.day_window_at := date_trunc('day', v_now);
    v_row.day_count := 0;
  end if;

  if v_row.ai_minute_window_at < date_trunc('minute', v_now) then
    v_row.ai_minute_window_at := date_trunc('minute', v_now);
    v_row.ai_minute_count := 0;
  end if;

  if v_row.ai_hour_window_at < date_trunc('hour', v_now) then
    v_row.ai_hour_window_at := date_trunc('hour', v_now);
    v_row.ai_hour_count := 0;
  end if;

  if p_mode = 'message' then
    if v_row.last_message_at is not null
       and v_row.last_message_hash is not null
       and p_message_hash = v_row.last_message_hash
       and extract(epoch from (v_now - v_row.last_message_at)) <= 20 then
      v_row.duplicate_count := v_row.duplicate_count + 1;
    else
      v_row.duplicate_count := 0;
    end if;

    v_row.minute_count := v_row.minute_count + 1;
    v_row.hour_count := v_row.hour_count + 1;
    v_row.day_count := v_row.day_count + 1;

    if v_row.duplicate_count >= 4 then
      v_message_allowed := false;
      v_reason := 'duplicate_burst';
      v_row.blocked_until := greatest(
        coalesce(v_row.blocked_until, v_now),
        v_now + interval '60 seconds'
      );
    elsif v_row.minute_count > 15 then
      v_message_allowed := false;
      v_reason := 'minute_limit';
      v_row.blocked_until := greatest(
        coalesce(v_row.blocked_until, v_now),
        date_trunc('minute', v_now) + interval '1 minute'
      );
    elsif v_row.hour_count > 80 then
      v_message_allowed := false;
      v_reason := 'hour_limit';
      v_row.blocked_until := greatest(
        coalesce(v_row.blocked_until, v_now),
        date_trunc('hour', v_now) + interval '1 hour'
      );
    elsif v_row.day_count > 300 then
      v_message_allowed := false;
      v_reason := 'day_limit';
      v_row.blocked_until := greatest(
        coalesce(v_row.blocked_until, v_now),
        date_trunc('day', v_now) + interval '1 day'
      );
    end if;

    if v_message_allowed and v_row.blocked_until is not null and v_row.blocked_until <= v_now then
      v_row.blocked_until := null;
    end if;

    v_row.last_message_hash := p_message_hash;
    v_row.last_message_at := v_now;
  end if;

  if v_row.blocked_until is not null and v_row.blocked_until > v_now then
    v_message_allowed := false;
    if v_reason is null then
      v_reason := 'blocked';
    end if;
    v_retry := greatest(1, ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer);
  else
    v_row.blocked_until := null;
  end if;

  if p_mode = 'ai' and v_message_allowed then
    v_row.ai_minute_count := v_row.ai_minute_count + 1;
    v_row.ai_hour_count := v_row.ai_hour_count + 1;

    if v_row.ai_minute_count > 4 then
      v_ai_allowed := false;
      v_reason := coalesce(v_reason, 'ai_minute_limit');
      v_row.blocked_until := greatest(
        coalesce(v_row.blocked_until, v_now),
        date_trunc('minute', v_now) + interval '1 minute'
      );
    elsif v_row.ai_hour_count > 30 then
      v_ai_allowed := false;
      v_reason := coalesce(v_reason, 'ai_hour_limit');
      v_row.blocked_until := greatest(
        coalesce(v_row.blocked_until, v_now),
        date_trunc('hour', v_now) + interval '1 hour'
      );
    end if;

    if not v_ai_allowed then
      v_retry := greatest(1, ceil(extract(epoch from (v_row.blocked_until - v_now)))::integer);
    end if;
  end if;

  if v_reason is not null
     and (v_row.last_block_notice_at is null
       or v_row.last_block_notice_at < v_now - interval '5 minutes') then
    v_notify := true;
    v_row.last_block_notice_at := v_now;
  end if;

  v_row.last_seen_at := v_now;
  v_row.updated_at := v_now;

  update public.messenger_rate_limits
     set country_code = v_row.country_code,
         minute_window_at = v_row.minute_window_at,
         minute_count = v_row.minute_count,
         hour_window_at = v_row.hour_window_at,
         hour_count = v_row.hour_count,
         day_window_at = v_row.day_window_at,
         day_count = v_row.day_count,
         ai_minute_window_at = v_row.ai_minute_window_at,
         ai_minute_count = v_row.ai_minute_count,
         ai_hour_window_at = v_row.ai_hour_window_at,
         ai_hour_count = v_row.ai_hour_count,
         last_message_hash = v_row.last_message_hash,
         last_message_at = v_row.last_message_at,
         duplicate_count = v_row.duplicate_count,
         blocked_until = v_row.blocked_until,
         last_block_notice_at = v_row.last_block_notice_at,
         last_seen_at = v_row.last_seen_at,
         updated_at = v_row.updated_at
   where id = v_row.id;

  return query
  select
    (v_message_allowed and v_ai_allowed),
    v_reason,
    v_retry,
    v_notify,
    v_row.minute_count,
    v_row.hour_count,
    v_row.day_count,
    v_row.ai_minute_count,
    v_row.ai_hour_count,
    v_row.duplicate_count,
    v_row.blocked_until;
end;
$function$;