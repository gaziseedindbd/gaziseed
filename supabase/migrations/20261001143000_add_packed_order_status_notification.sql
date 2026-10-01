create or replace function public.enqueue_messenger_order_status_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_effective text;
  new_effective text;
begin
  if coalesce(new.order_source, '') <> 'facebook_messenger_ai' then
    return new;
  end if;

  old_effective := lower(trim(coalesce(old.order_status, old.status, '')));
  new_effective := lower(trim(coalesce(new.order_status, new.status, '')));

  if new_effective = '' or new_effective = old_effective then
    return new;
  end if;

  if new_effective not in (
    'pending',
    'processing',
    'packed',
    'shipped',
    'delivered',
    'cancelled',
    'rejected'
  ) then
    return new;
  end if;

  if trim(coalesce(new.customer_phone, '')) = '' then
    return new;
  end if;

  insert into public.messenger_order_status_notifications (
    order_id,
    country_code,
    event_type,
    old_status,
    new_status,
    phone
  )
  values (
    new.id,
    new.country_code,
    'order_status_changed',
    nullif(old_effective, ''),
    new_effective,
    trim(new.customer_phone)
  )
  on conflict (order_id, new_status) do nothing;

  return new;
exception
  when others then
    raise warning 'Messenger order status notification enqueue failed for order %: %', new.id, sqlerrm;
    return new;
end;
$$;
