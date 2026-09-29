-- Messenger product search optimization
-- Adds indexed full-text + trigram/fuzzy search while preserving the existing product schema.

create extension if not exists pg_trgm with schema extensions;

alter table public.products
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'simple'::regconfig,
      concat_ws(
        ' ',
        coalesce(name_bn, ''),
        coalesce(name_en, ''),
        coalesce(slug, ''),
        coalesce(sku, ''),
        coalesce(title, ''),
        coalesce(name, ''),
        coalesce(brand, ''),
        coalesce(origin, ''),
        coalesce(variety, ''),
        coalesce(seed_type, ''),
        coalesce(season, ''),
        coalesce(planting_season, ''),
        coalesce(short_description, '')
      )
    )
  ) stored;

create index if not exists idx_products_search_vector
  on public.products using gin (search_vector);

create index if not exists idx_products_name_bn_trgm
  on public.products using gin (lower(name_bn) extensions.gin_trgm_ops);

create index if not exists idx_products_name_en_trgm
  on public.products using gin (lower(name_en) extensions.gin_trgm_ops);

create index if not exists idx_products_slug_trgm
  on public.products using gin (lower(slug) extensions.gin_trgm_ops);

create index if not exists idx_products_sku_trgm
  on public.products using gin (lower(sku) extensions.gin_trgm_ops);

create index if not exists idx_products_country_active
  on public.products (country_code, is_active);

create or replace function public.search_messenger_products(
  p_country text,
  p_query text,
  p_limit integer default 12
)
returns table (
  id uuid,
  name_bn text,
  name_en text,
  slug text,
  short_description text,
  regular_price numeric,
  sale_price numeric,
  offer_price numeric,
  price numeric,
  stock integer,
  is_active boolean,
  seed_type text,
  variety text,
  season text,
  planting_season text,
  packet_weight text,
  germination_time text,
  germination_rate text,
  harvest_time text,
  country_code text,
  search_match_type text,
  search_match_score real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with input as (
    select
      trim(regexp_replace(lower(coalesce(p_query, '')), '\\s+', ' ', 'g')) as q,
      lower(
        replace(
          trim(regexp_replace(lower(coalesce(p_query, '')), '\\s+', ' ', 'g')),
          ' ',
          '-'
        )
      ) as q_slug,
      websearch_to_tsquery(
        'simple'::regconfig,
        trim(regexp_replace(lower(coalesce(p_query, '')), '\\s+', ' ', 'g'))
      ) as tsq
  ),
  ranked as (
    select
      p.id,
      p.name_bn,
      p.name_en,
      p.slug,
      p.short_description,
      p.regular_price,
      p.sale_price,
      p.offer_price,
      p.price,
      p.stock,
      p.is_active,
      p.seed_type,
      p.variety,
      p.season,
      p.planting_season,
      p.packet_weight,
      p.germination_time,
      p.germination_rate,
      p.harvest_time,
      p.country_code,
      (
        lower(coalesce(p.name_bn, '')) = i.q
        or lower(coalesce(p.name_en, '')) = i.q
        or lower(coalesce(p.slug, '')) = i.q_slug
        or lower(coalesce(p.sku, '')) = i.q
      ) as is_exact,
      (
        lower(coalesce(p.name_bn, '')) like '%' || i.q || '%'
        or lower(coalesce(p.name_en, '')) like '%' || i.q || '%'
        or lower(coalesce(p.slug, '')) like '%' || i.q_slug || '%'
        or lower(coalesce(p.sku, '')) like '%' || i.q || '%'
      ) as has_phrase_match,
      coalesce(ts_rank_cd(p.search_vector, i.tsq), 0)::real as fts_rank,
      greatest(
        extensions.similarity(lower(coalesce(p.name_bn, '')), i.q),
        extensions.similarity(lower(coalesce(p.name_en, '')), i.q),
        extensions.similarity(lower(coalesce(p.slug, '')), i.q_slug),
        extensions.similarity(lower(coalesce(p.sku, '')), i.q),
        extensions.word_similarity(i.q, lower(coalesce(p.name_bn, ''))),
        extensions.word_similarity(i.q, lower(coalesce(p.name_en, ''))),
        extensions.word_similarity(i.q_slug, lower(coalesce(p.slug, '')))
      )::real as fuzzy_rank
    from public.products p
    cross join input i
    where p.is_active = true
      and p.country_code = p_country
      and i.q <> ''
      and (
        lower(coalesce(p.name_bn, '')) = i.q
        or lower(coalesce(p.name_en, '')) = i.q
        or lower(coalesce(p.slug, '')) = i.q_slug
        or lower(coalesce(p.sku, '')) = i.q
        or lower(coalesce(p.name_bn, '')) like '%' || i.q || '%'
        or lower(coalesce(p.name_en, '')) like '%' || i.q || '%'
        or lower(coalesce(p.slug, '')) like '%' || i.q_slug || '%'
        or lower(coalesce(p.sku, '')) like '%' || i.q || '%'
        or p.search_vector @@ i.tsq
        or extensions.word_similarity(i.q, lower(coalesce(p.name_bn, ''))) >= 0.24
        or extensions.word_similarity(i.q, lower(coalesce(p.name_en, ''))) >= 0.24
        or extensions.word_similarity(i.q_slug, lower(coalesce(p.slug, ''))) >= 0.24
      )
  )
  select
    r.id,
    r.name_bn,
    r.name_en,
    r.slug,
    r.short_description,
    r.regular_price,
    r.sale_price,
    r.offer_price,
    r.price,
    r.stock,
    r.is_active,
    r.seed_type,
    r.variety,
    r.season,
    r.planting_season,
    r.packet_weight,
    r.germination_time,
    r.germination_rate,
    r.harvest_time,
    r.country_code,
    case
      when r.is_exact then 'exact'
      when r.has_phrase_match or r.fts_rank > 0 or r.fuzzy_rank >= 0.55 then 'strong'
      else 'similar'
    end as search_match_type,
    case
      when r.is_exact then 1.0::real
      else greatest(least(r.fts_rank, 1.0::real), r.fuzzy_rank)
    end as search_match_score
  from ranked r
  order by
    case
      when r.is_exact then 0
      when r.has_phrase_match or r.fts_rank > 0 or r.fuzzy_rank >= 0.55 then 1
      else 2
    end,
    case
      when r.is_exact then 1.0::real
      else greatest(least(r.fts_rank, 1.0::real), r.fuzzy_rank)
    end desc,
    case when coalesce(r.stock, 0) > 0 then 1 else 0 end desc,
    lower(coalesce(r.name_bn, r.name_en, r.slug, ''))
  limit greatest(1, least(coalesce(p_limit, 12), 20));
$$;

revoke all on function public.search_messenger_products(text, text, integer) from public, anon, authenticated;
grant execute on function public.search_messenger_products(text, text, integer) to service_role;
