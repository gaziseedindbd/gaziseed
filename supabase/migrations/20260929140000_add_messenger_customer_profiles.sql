create table if not exists public.messenger_customer_profiles (
  id uuid primary key default gen_random_uuid(),
  page_id text not null,
  external_user_id text not null,
  country_code text not null default 'BD' check (country_code in ('BD','IN')),
  name text,
  phone text,
  address text,
  total_orders integer not null default 0,
  total_spent numeric(14,2) not null default 0,
  last_order_id uuid references public.orders(id) on delete set null,
  last_order_number text,
  order_numbers jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(page_id, external_user_id, country_code)
);

alter table public.messenger_customer_profiles enable row level security;

create index if not exists idx_messenger_customer_profiles_phone_country
  on public.messenger_customer_profiles(country_code, phone);

create index if not exists idx_messenger_customer_profiles_last_order
  on public.messenger_customer_profiles(last_order_id);

drop policy if exists "admins_read_messenger_customer_profiles" on public.messenger_customer_profiles;
create policy "admins_read_messenger_customer_profiles"
on public.messenger_customer_profiles
for select
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
      and admin_users.is_active = true
  )
);

drop policy if exists "admins_write_messenger_customer_profiles" on public.messenger_customer_profiles;
create policy "admins_write_messenger_customer_profiles"
on public.messenger_customer_profiles
for all
to authenticated
using (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
      and admin_users.is_active = true
  )
)
with check (
  exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
      and admin_users.is_active = true
  )
);

create or replace function public.update_messenger_customer_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists messenger_customer_profiles_updated_at
on public.messenger_customer_profiles;

create trigger messenger_customer_profiles_updated_at
before update on public.messenger_customer_profiles
for each row
execute function public.update_messenger_customer_profiles_updated_at();
