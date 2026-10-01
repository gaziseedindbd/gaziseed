create table if not exists public.messenger_order_notifications (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  country_code text not null check (country_code in ('IN', 'BD')),
  event_type text not null default 'order_confirmed' check (event_type = 'order_confirmed'),
  phone text not null,
  page_id text,
  external_user_id text,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, event_type)
);

create index if not exists messenger_order_notifications_status_idx
  on public.messenger_order_notifications (status, created_at);

create index if not exists messenger_order_notifications_order_idx
  on public.messenger_order_notifications (order_id);

alter table public.messenger_order_notifications enable row level security;

create or replace function public.enqueue_messenger_order_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.order_source, '') <> 'facebook_messenger_ai' then
    return new;
  end if;

  if lower(coalesce(new.order_status, new.status, '')) in ('cancelled', 'rejected') then
    return new;
  end if;

  if new.country_code = 'IN'
     and lower(coalesce(new.payment_status, '')) not in ('paid', 'partially_paid') then
    return new;
  end if;

  insert into public.messenger_order_notifications (
    order_id,
    country_code,
    event_type,
    phone
  )
  values (
    new.id,
    new.country_code,
    'order_confirmed',
    trim(coalesce(new.customer_phone, ''))
  )
  on conflict (order_id, event_type) do nothing;

  return new;
exception
  when others then
    raise warning 'Messenger order notification enqueue failed for order %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists trg_enqueue_messenger_order_confirmation on public.orders;

create trigger trg_enqueue_messenger_order_confirmation
after insert or update of order_status, status, payment_status
on public.orders
for each row
execute function public.enqueue_messenger_order_confirmation();

comment on table public.messenger_order_notifications is
  'Deterministic Messenger order lifecycle notification queue. Service-role access only.';
