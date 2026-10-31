create or replace function public.crm_branch_message_recipients(p_country_code text)
returns table(user_id uuid, display_name text)
language sql stable security definer set search_path = pg_catalog, public, auth
as $$
  select distinct on (o.user_id) o.user_id,
    coalesce(nullif(btrim(o.customer_name), ''), 'Customer') as display_name
  from public.orders o
  join auth.users u on u.id = o.user_id
  where auth.uid() is not null and public.is_admin()
    and public.can_access_country(p_country_code)
    and upper(o.country_code) = upper(p_country_code)
    and o.user_id is not null
    and not exists (select 1 from public.admin_users a where a.user_id = o.user_id)
  order by o.user_id, o.created_at desc;
$$;

revoke all on function public.crm_branch_message_recipients(text) from public, anon;
grant execute on function public.crm_branch_message_recipients(text) to authenticated;
