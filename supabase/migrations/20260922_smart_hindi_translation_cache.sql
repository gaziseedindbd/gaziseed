create table if not exists public.translation_cache (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  target_lang text not null,
  source_hash text not null,
  translated_payload jsonb not null default '{}'::jsonb,
  provider text not null default 'google-cloud-translation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (entity_type, entity_id, target_lang)
);

create index if not exists translation_cache_lookup_idx
  on public.translation_cache (entity_type, entity_id, target_lang);

alter table public.translation_cache enable row level security;

revoke all on public.translation_cache from anon, authenticated;

drop policy if exists translation_cache_deny_public on public.translation_cache;
create policy translation_cache_deny_public
on public.translation_cache
for all
to anon, authenticated
using (false)
with check (false);
