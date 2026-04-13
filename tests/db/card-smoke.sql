\echo 'Listing public tables'
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;

\echo 'Inspecting public.cards columns'
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'cards'
order by ordinal_position;

\echo 'Checking for suspicious identical non-ASCII English/Japanese names'
do $$
declare
  identical_non_ascii_count integer;
  max_allowed_identical_non_ascii_count integer := 250;
begin
  select count(*)
  into identical_non_ascii_count
  from public.cards
  where name_jp is not null
    and name_en = name_jp
    and octet_length(name_en) <> char_length(name_en);

  if identical_non_ascii_count > max_allowed_identical_non_ascii_count then
    raise exception
      'Too many cards have identical non-ASCII name_en/name_jp values: % rows, threshold %',
      identical_non_ascii_count,
      max_allowed_identical_non_ascii_count;
  end if;

  raise notice
    'Identical non-ASCII name_en/name_jp rows: %, threshold %',
    identical_non_ascii_count,
    max_allowed_identical_non_ascii_count;
end $$;

\echo 'Fetching sample rows from public.cards'
select
  id,
  card_set_id,
  name_en,
  name_jp,
  card_type,
  rarity_base,
  attribute,
  color,
  cost,
  power,
  counter,
  sub_types,
  text_en,
  text_jp,
  created_at,
  updated_at
from public.cards
limit 3;
