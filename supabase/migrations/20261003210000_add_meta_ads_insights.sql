create table if not exists public.meta_ads_insights_daily (
  id uuid primary key default gen_random_uuid(),
  country_code text not null check (country_code = any (array['BD'::text, 'IN'::text])),
  ad_account_id text not null,
  account_name text,
  account_currency text,
  date_start date not null,
  date_stop date not null,
  campaign_id text not null,
  campaign_name text not null default '',
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  spend numeric(18,4) not null default 0,
  ctr numeric(18,6) not null default 0,
  cpc numeric(18,6) not null default 0,
  purchases numeric(18,4) not null default 0,
  purchase_value numeric(18,4) not null default 0,
  purchase_roas numeric(18,6) not null default 0,
  actions jsonb not null default '[]'::jsonb,
  action_values jsonb not null default '[]'::jsonb,
  fetched_at timestamp with time zone not null default now(),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (country_code, ad_account_id, date_start, date_stop, campaign_id)
);

comment on table public.meta_ads_insights_daily is 'Internal Meta Ads Insights API snapshot. Service-role access only.';

create index if not exists meta_ads_insights_daily_country_date_idx
  on public.meta_ads_insights_daily (country_code, date_start desc);

create index if not exists meta_ads_insights_daily_campaign_idx
  on public.meta_ads_insights_daily (country_code, campaign_id, date_start desc);

alter table public.meta_ads_insights_daily enable row level security;
revoke all on table public.meta_ads_insights_daily from anon, authenticated;
grant all on table public.meta_ads_insights_daily to service_role;
