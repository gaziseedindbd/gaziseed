-- Atomic branch-scoped simple policy. Not applied until preview and checkout regression review.
create or replace function public.admin_set_simple_delivery_policy(
 p_country text, p_threshold numeric, p_charge numeric
) returns void language plpgsql security definer set search_path=public as $$
declare v_country text := upper(trim(coalesce(p_country,'')));
begin
 if auth.uid() is null or not public.is_admin() or public.current_admin_country() <> v_country then
   raise exception 'Not authorized for delivery settings';
 end if;
 if v_country not in ('IN','BD') or p_threshold is null or p_charge is null or
    p_threshold < 0 or p_threshold > 1000000 or p_charge < 0 or p_charge > 100000 or
    p_threshold <> round(p_threshold,2) or p_charge <> round(p_charge,2) then
   raise exception 'Invalid delivery threshold or charge';
 end if;
 perform pg_advisory_xact_lock(hashtext('delivery_policy_'||v_country));
 update public.delivery_charge_rules set is_active=false, updated_at=now()
   where country_code=v_country and is_active=true;
 insert into public.delivery_charge_rules
   (country_code,title,subtitle,min_order,max_order,charge,currency,is_free,featured,display_order,is_active)
 values
   (v_country,'Standard delivery','Delivery fee up to '||p_threshold,0,p_threshold,p_charge,
    case when v_country='IN' then 'INR' else 'BDT' end,false,false,1,true),
   (v_country,'Free delivery','Free above '||p_threshold,p_threshold+0.01,null,0,
    case when v_country='IN' then 'INR' else 'BDT' end,true,true,2,true);
end $$;
revoke all on function public.admin_set_simple_delivery_policy(text,numeric,numeric) from public,anon;
grant execute on function public.admin_set_simple_delivery_policy(text,numeric,numeric) to authenticated;
