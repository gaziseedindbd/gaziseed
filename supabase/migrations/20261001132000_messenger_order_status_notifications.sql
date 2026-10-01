create table if not exists public.messenger_order_status_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  country_code text not null check (country_code in ('IN', 'BD')),
  event_type text not null default 'order_status_changed' check (event_type = 'order_status_changed'),
  old_status text,
  new_status text not null,
  phone text not null,
  page_id text,
  external_user_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, new_status)
);

create index if not exists messenger_order_status_notifications_status_idx
  on public.messenger_order_status_notifications (status, created_at);

create index if not exists messenger_order_status_notifications_order_idx
  on public.messenger_order_status_notifications (order_id);

alter table public.messenger_order_status_notifications enable row level security;

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

drop trigger if exists trg_enqueue_messenger_order_status_notification on public.orders;

create trigger trg_enqueue_messenger_order_status_notification
after update of order_status, status
on public.orders
for each row
execute function public.enqueue_messenger_order_status_notification();

comment on table public.messenger_order_status_notifications is
  'Deterministic Messenger order-status change notification queue. Service-role access only.';
