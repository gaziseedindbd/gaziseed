create table if not exists public.crm_customer_message_campaigns (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('BD', 'IN')),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 2000),
  created_by uuid not null references auth.users(id) on delete restrict default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.crm_customer_message_deliveries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.crm_customer_message_campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (campaign_id, user_id)
);

create index if not exists crm_customer_message_deliveries_user_created_idx
  on public.crm_customer_message_deliveries(user_id, created_at desc);

alter table public.crm_customer_message_campaigns enable row level security;
alter table public.crm_customer_message_deliveries enable row level security;

drop policy if exists crm_message_campaign_admin_read on public.crm_customer_message_campaigns;
create policy crm_message_campaign_admin_read on public.crm_customer_message_campaigns
  for select to authenticated using (
    (public.is_admin() and public.can_access_country(country_code))
    or exists (
      select 1 from public.crm_customer_message_deliveries d
      where d.campaign_id = id and d.user_id = (select auth.uid())
    )
  );

drop policy if exists crm_message_delivery_customer_read on public.crm_customer_message_deliveries;
create policy crm_message_delivery_customer_read on public.crm_customer_message_deliveries
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists crm_message_delivery_customer_mark_read on public.crm_customer_message_deliveries;
create policy crm_message_delivery_customer_mark_read on public.crm_customer_message_deliveries
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.crm_customer_message_campaigns from anon, public, authenticated;
revoke all on public.crm_customer_message_deliveries from anon, public, authenticated;
grant select on public.crm_customer_message_campaigns to authenticated;
grant select on public.crm_customer_message_deliveries to authenticated;
grant update (read_at) on public.crm_customer_message_deliveries to authenticated;

create or replace function public.crm_send_customer_message(
  p_country_code text,
  p_title text,
  p_body text,
  p_user_ids uuid[]
) returns table(campaign_id uuid, delivered_count integer)
language plpgsql security definer set search_path = pg_catalog, public, auth
as $$
declare
  v_campaign_id uuid;
  v_count integer;
begin
  if auth.uid() is null or not public.is_admin() or not public.can_access_country(p_country_code) then
    raise exception 'Not authorized for this branch' using errcode = '42501';
  end if;
  if p_country_code not in ('BD', 'IN') or char_length(btrim(coalesce(p_title, ''))) not between 1 and 120
     or char_length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then
    raise exception 'Invalid message';
  end if;
  if coalesce(cardinality(p_user_ids), 0) < 1 or cardinality(p_user_ids) > 10000 then
    raise exception 'Select at least one registered customer';
  end if;

  insert into public.crm_customer_message_campaigns(country_code, title, body, created_by)
  values (p_country_code, btrim(p_title), btrim(p_body), auth.uid()) returning id into v_campaign_id;

  insert into public.crm_customer_message_deliveries(campaign_id, user_id)
  select v_campaign_id, recipient.user_id
  from (select distinct unnest(p_user_ids) as user_id) recipient
  join auth.users u on u.id = recipient.user_id
  where exists (select 1 from public.orders o where o.user_id = recipient.user_id and upper(o.country_code) = upper(p_country_code))
    and not exists (select 1 from public.admin_users a where a.user_id = recipient.user_id);

  get diagnostics v_count = row_count;
  if v_count = 0 then raise exception 'No eligible registered customers in this branch'; end if;
  return query select v_campaign_id, v_count;
end;
$$;

revoke all on function public.crm_send_customer_message(text, text, text, uuid[]) from public, anon;
grant execute on function public.crm_send_customer_message(text, text, text, uuid[]) to authenticated;
