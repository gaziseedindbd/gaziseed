-- Branch-scoped CRM workspace data. Customer identity is stored as an opaque
-- key so notes, tags, and tasks do not duplicate customer names or phone data.

create table if not exists public.crm_customer_notes (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('BD', 'IN')),
  customer_key text not null check (length(customer_key) between 6 and 180),
  note text not null check (length(trim(note)) between 1 and 5000),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists idx_crm_customer_notes_branch_customer_created
  on public.crm_customer_notes(country_code, customer_key, created_at desc);

alter table public.crm_customer_notes enable row level security;
drop policy if exists crm_customer_notes_branch_read on public.crm_customer_notes;
create policy crm_customer_notes_branch_read
  on public.crm_customer_notes for select to authenticated
  using (public.can_access_country(country_code));
drop policy if exists crm_customer_notes_branch_insert on public.crm_customer_notes;
create policy crm_customer_notes_branch_insert
  on public.crm_customer_notes for insert to authenticated
  with check (public.can_access_country(country_code) and created_by = auth.uid());

create table if not exists public.crm_customer_tags (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('BD', 'IN')),
  customer_key text not null check (length(customer_key) between 6 and 180),
  tag text not null check (length(trim(tag)) between 1 and 40),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (country_code, customer_key, tag)
);

create index if not exists idx_crm_customer_tags_branch_customer
  on public.crm_customer_tags(country_code, customer_key);

alter table public.crm_customer_tags enable row level security;
drop policy if exists crm_customer_tags_branch_access on public.crm_customer_tags;
create policy crm_customer_tags_branch_access
  on public.crm_customer_tags for all to authenticated
  using (public.can_access_country(country_code))
  with check (public.can_access_country(country_code) and created_by = auth.uid());

create table if not exists public.crm_follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('BD', 'IN')),
  customer_key text not null check (length(customer_key) between 6 and 180),
  title text not null check (length(trim(title)) between 1 and 160),
  description text check (description is null or length(description) <= 2000),
  due_at timestamptz not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  status text not null default 'open' check (status in ('open', 'completed', 'cancelled')),
  assigned_to uuid references auth.users(id) on delete set null default auth.uid(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (assigned_to is null or created_by is null or assigned_to = created_by)
);

create index if not exists idx_crm_follow_up_tasks_branch_status_due
  on public.crm_follow_up_tasks(country_code, status, due_at);
create index if not exists idx_crm_follow_up_tasks_branch_customer
  on public.crm_follow_up_tasks(country_code, customer_key);

alter table public.crm_follow_up_tasks enable row level security;
drop policy if exists crm_follow_up_tasks_branch_access on public.crm_follow_up_tasks;
create policy crm_follow_up_tasks_branch_access
  on public.crm_follow_up_tasks for all to authenticated
  using (public.can_access_country(country_code))
  with check (
    public.can_access_country(country_code)
    and created_by = auth.uid()
    and (assigned_to is null or assigned_to = auth.uid())
  );

create table if not exists public.crm_saved_segments (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code in ('BD', 'IN')),
  name text not null check (length(trim(name)) between 1 and 80),
  description text check (description is null or length(description) <= 500),
  filter_key text not null check (filter_key in ('all', 'repeat', 'one_time', 'inactive_90_days', 'open_orders')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (country_code, name)
);

create index if not exists idx_crm_saved_segments_branch_created
  on public.crm_saved_segments(country_code, created_at desc);

alter table public.crm_saved_segments enable row level security;
drop policy if exists crm_saved_segments_branch_access on public.crm_saved_segments;
create policy crm_saved_segments_branch_access
  on public.crm_saved_segments for all to authenticated
  using (public.can_access_country(country_code))
  with check (public.can_access_country(country_code) and created_by = auth.uid());

grant select, insert on public.crm_customer_notes to authenticated;
grant select, insert, delete on public.crm_customer_tags to authenticated;
grant select, insert, update, delete on public.crm_follow_up_tasks to authenticated;
grant select, insert, delete on public.crm_saved_segments to authenticated;

comment on table public.crm_customer_notes is 'Branch-scoped internal notes attached to pseudonymous CRM customer keys.';
comment on table public.crm_customer_tags is 'Branch-scoped customer tag assignments.';
comment on table public.crm_follow_up_tasks is 'Branch-scoped customer follow-up tasks assigned to the current admin.';
comment on table public.crm_saved_segments is 'Branch-scoped saved customer segment definitions.';
