-- Fix the transliteration word-final cleanup and refresh stored aliases.

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
      v_result := v_result || case v_char
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
  v_result := regexp_replace(v_result, 'a( |$)', '\1', 'g');

  return trim(v_result);
end;
$$;

update public.products
set search_translit = public.bangla_search_transliteration(coalesce(name_bn, ''));

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
  );
