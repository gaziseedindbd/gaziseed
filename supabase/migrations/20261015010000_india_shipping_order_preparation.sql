-- India-only manual packing drafts. No shipment or payment state change.
create table if not exists public.india_shipping_preparations (
 order_id uuid primary key references public.orders(id) on delete restrict,
 country_code text not null default 'IN' check (country_code='IN'),
 delivery_pin text not null check (delivery_pin ~ '^[1-9][0-9]{5}$'),
 weight_kg numeric(9,3) not null check (weight_kg>0 and weight_kg<=100),
 length_cm numeric(9,2) not null check (length_cm>0 and length_cm<=200),
 breadth_cm numeric(9,2) not null check (breadth_cm>0 and breadth_cm<=200),
 height_cm numeric(9,2) not null check (height_cm>0 and height_cm<=200),
 packing_notes text not null default '' check (length(packing_notes)<=500),
 updated_by uuid not null,
 updated_at timestamptz not null default now()
);
alter table public.india_shipping_preparations enable row level security;
revoke all on public.india_shipping_preparations from anon, authenticated;
create or replace function public.guard_india_shipping_preparation()
returns trigger language plpgsql set search_path=public as $$
begin
 if not exists(select 1 from public.orders where id=new.order_id and country_code='IN') then
  raise exception 'India orders only';
 end if;
 return new;
end $$;
drop trigger if exists india_shipping_preparation_guard on public.india_shipping_preparations;
create trigger india_shipping_preparation_guard before insert or update on public.india_shipping_preparations
for each row execute function public.guard_india_shipping_preparation();