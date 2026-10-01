-- Messenger product search: Bengali transliteration support.
-- Keeps the existing FTS/trigram search and adds a normalized Latin transliteration
-- derived from Bengali product names, so queries such as "golap" and "morich"
-- can match Bengali catalog names without changing the product-facing schema.

alter table public.products
  add column if not exists search_translit text;

create or replace function public.bangla_search_transliteration(p_text text)
returns text
language plpgsql
immutable
parallel safe
set search_path = public, pg_catalog, extensions
as $$
declare
  v_input text := lower(coalesce(p_text, ''));
  v_result text := '';
  v_char text;
  v_next text;
  v_mapped text;
  v_i integer := 1;
begin
  v_input := regexp_replace(v_input, '[^a-z0-9\u0980-\u09ff]+', ' ', 'g');
  v_input := regexp_replace(v_input, '\\s+', ' ', 'g');
  v_input := trim(v_input);

  while v_i <= char_length(v_input) loop
    v_char := substr(v_input, v_i, 1);
    v_next := substr(v_input, v_i + 1, 1);

    if v_char ~ '[a-z0-9]' then
      v_result := v_result || v_char;

    elsif v_char = ' ' then
      v_result := v_result || ' ';

    elsif v_char in ('া','ি','ী','ু','ূ','ৃ','ে','ৈ','ো','ৌ') then
      v_mapped := case v_char
        when 'া' then 'a'
        when 'ি' then 'i'
        when 'ী' then 'i'
        when 'ু' then 'u'
        when 'ূ' then 'u'
        when 'ৃ' then 'ri'
        when 'ে' then 'e'
        when 'ৈ' then 'oi'
        when 'ো' then 'o'
        when 'ৌ' then 'ou'
        else ''
      end;
      v_result := v_result || v_mapped;

    elsif v_char in ('অ','আ','ই','ঈ','উ','ঊ','ঋ','এ','ঐ','ও','ঔ') then
      v_result := v_result || case v_char
        when 'অ' then 'a'
        when 'আ' then 'a'
        when 'ই' then 'i'
        when 'ঈ' then 'i'
        when 'উ' then 'u'
        when 'ঊ' then 'u'
        when 'ঋ' then 'ri'
        when 'এ' then 'e'
        when 'ঐ' then 'oi'
        when 'ও' then 'o'
        when 'ঔ' then 'ou'
        else ''
      end;

    elsif v_char = 'ং' then
      v_result := v_result || 'n';

    elsif v_char = 'ঁ' then
      v_result := v_result || 'n';

    elsif v_char = 'ঃ' then
      v_result := v_result || 'h';

    elsif v_char = '্' then
      null;

    elsif v_char in (
      'ক','খ','গ','ঘ','ঙ','চ','ছ','জ','ঝ','ঞ','ট','ঠ','ড','ঢ','ণ',
      'ত','থ','দ','ধ','ন','প','ফ','ব','ভ','ম','য','র','ল','শ','ষ','স','হ',
      'ড়','ঢ়','য়','ৎ'
    ) then
      v_mapped := case v_char
        when 'ক' then 'k'
        when 'খ' then 'kh'
        when 'গ' then 'g'
        when 'ঘ' then 'gh'
        when 'ঙ' then 'ng'
        when 'চ' then 'ch'
        when 'ছ' then 'chh'
        when 'জ' then 'j'
        when 'ঝ' then 'jh'
        when 'ঞ' then 'n'
        when 'ট' then 't'
        when 'ঠ' then 'th'
        when 'ড' then 'd'
        when 'ঢ' then 'dh'
        when 'ণ' then 'n'
        when 'ত' then 't'
        when 'থ' then 'th'
        when 'দ' then 'd'
        when 'ধ' then 'dh'
        when 'ন' then 'n'
        when 'প' then 'p'
        when 'ফ' then 'ph'
        when 'ব' then 'b'
        when 'ভ' then 'bh'
        when 'ম' then 'm'
        when 'য' then 'y'
        when 'র' then 'r'
        when 'ল' then 'l'
        when 'শ' then 'sh'
        when 'ষ' then 'sh'
        when 'স' then 's'
        when 'হ' then 'h'
        when 'ড়' then 'r'
        when 'ঢ়' then 'rh'
        when 'য়' then 'y'
        when 'ৎ' then 't'
        else ''
      end;

      v_result := v_result || v_mapped;

      if v_next = '্' then
        v_i := v_i + 1;
      elsif v_next is null or v_next = ' ' or v_next !~ '[া-ৌৃ]' then
        v_result := v_result || 'a';
      end if;

    else
      v_result := v_result || ' ';
    end if;

    v_i := v_i + 1;
  end loop;

  v_result := regexp_replace(v_result, '\\s+', ' ', 'g');
  v_result := trim(v_result);
  -- Bengali consonants have an implicit final "a" in this simple phonetic model.
  -- Dropping a word-final "a" aligns common catalogue spellings such as golap,
  -- morich, kadu, etc. while keeping the matching tolerant.
  v_result := regexp_replace(v_result, 'a( |$)', '\\1', 'g');

  return trim(v_result);
end;
$$;

create or replace function public.products_search_vector_update()
returns trigger
language plpgsql
set search_path = public, pg_catalog, extensions
as $$
begin
  new.search_translit :=
    public.bangla_search_transliteration(coalesce(new.name_bn, ''));

  new.search_vector :=
    to_tsvector(
      'simple'::regconfig,
      concat_ws(
        ' ',
        coalesce(new.name_bn, ''),
        coalesce(new.name_en, ''),
        coalesce(new.slug, ''),
        coalesce(new.sku, ''),
        coalesce(new.title, ''),
        coalesce(new.name, ''),
        coalesce(new.brand, ''),
        coalesce(new.origin, ''),
        coalesce(new.variety, ''),
        coalesce(new.seed_type, ''),
        coalesce(new.season, ''),
        coalesce(new.planting_season, ''),
        coalesce(new.short_description, ''),
        coalesce(new.search_translit, '')
      )
    );

  return new;
end;
$$;

update public.products
set search_translit = public.bangla_search_transliteration(coalesce(name_bn, ''))
where search_translit is null;

update public.products
set search_vector =
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
      coalesce(short_description, ''),
      coalesce(search_translit, '')
    )
  )
where search_vector is null
   or search_translit is not null;

create index if not exists idx_products_search_translit_trgm
  on public.products using gin (lower(search_translit) extensions.gin_trgm_ops);

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
set search_path = public, pg_catalog, extensions
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
      public.bangla_search_transliteration(p_query) as q_latin,
      lower(
        replace(
          public.bangla_search_transliteration(p_query),
          ' ',
          '-'
        )
      ) as q_latin_slug,
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
        or lower(coalesce(p.search_translit, '')) = i.q_latin
      ) as is_exact,
      (
        lower(coalesce(p.name_bn, '')) like '%' || i.q || '%'
        or lower(coalesce(p.name_en, '')) like '%' || i.q || '%'
        or lower(coalesce(p.slug, '')) like '%' || i.q_slug || '%'
        or lower(coalesce(p.sku, '')) like '%' || i.q || '%'
        or lower(coalesce(p.search_translit, '')) like '%' || i.q_latin || '%'
        or lower(coalesce(p.search_translit, '')) like '%' || i.q_latin_slug || '%'
      ) as has_phrase_match,
      coalesce(ts_rank_cd(p.search_vector, i.tsq), 0)::real as fts_rank,
      greatest(
        similarity(lower(coalesce(p.name_bn, '')), i.q),
        similarity(lower(coalesce(p.name_en, '')), i.q),
        similarity(lower(coalesce(p.slug, '')), i.q_slug),
        similarity(lower(coalesce(p.sku, '')), i.q),
        similarity(lower(coalesce(p.search_translit, '')), i.q_latin),
        word_similarity(i.q, lower(coalesce(p.name_bn, ''))),
        word_similarity(i.q, lower(coalesce(p.name_en, ''))),
        word_similarity(i.q_slug, lower(coalesce(p.slug, ''))),
        word_similarity(i.q_latin, lower(coalesce(p.search_translit, ''))),
        word_similarity(i.q_latin_slug, lower(coalesce(p.search_translit, '')))
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
        or lower(coalesce(p.search_translit, '')) = i.q_latin
        or lower(coalesce(p.name_bn, '')) like '%' || i.q || '%'
        or lower(coalesce(p.name_en, '')) like '%' || i.q || '%'
        or lower(coalesce(p.slug, '')) like '%' || i.q_slug || '%'
        or lower(coalesce(p.sku, '')) like '%' || i.q || '%'
        or lower(coalesce(p.search_translit, '')) like '%' || i.q_latin || '%'
        or lower(coalesce(p.search_translit, '')) like '%' || i.q_latin_slug || '%'
        or p.search_vector @@ i.tsq
        or word_similarity(i.q, lower(coalesce(p.name_bn, ''))) >= 0.24
        or word_similarity(i.q, lower(coalesce(p.name_en, ''))) >= 0.24
        or word_similarity(i.q_slug, lower(coalesce(p.slug, ''))) >= 0.24
        or word_similarity(i.q_latin, lower(coalesce(p.search_translit, ''))) >= 0.24
        or word_similarity(i.q_latin_slug, lower(coalesce(p.search_translit, ''))) >= 0.24
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
