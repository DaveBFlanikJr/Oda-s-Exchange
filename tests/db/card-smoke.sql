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

\echo 'Fetching sample rows from public.cards'
select
  id,
  card_set_id,
  name_en,
  name_jp,
  card_type,
  game,
  set_id,
  set_name_en,
  set_name_jp,
  rarity,
  card_category,
  card_color,
  card_cost,
  card_power,
  counter_amount,
  attribute,
  sub_types,
  card_text,
  card_image
from public.cards
limit 3;
