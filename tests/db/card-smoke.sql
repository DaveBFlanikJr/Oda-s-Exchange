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

\echo 'Fetching sample rows from public.card_variants'
select
  id,
  card_id,
  source_record_id,
  source_variant_key,
  variant_type,
  variant_rarity,
  set_id,
  image_url,
  is_active,
  created_at,
  updated_at
from public.card_variants
limit 3;

\echo 'Inspecting public.raw_price_observations columns'
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'raw_price_observations'
order by ordinal_position;

\echo 'Fetching sample rows from public.raw_price_observations'
select
  source,
  source_listing_id,
  normalized_card_code,
  source_variant_key,
  normalized_condition,
  price_jpy,
  availability_status,
  listing_kind,
  normalized_parse_output,
  snapshot_ref,
  match_confidence,
  matched_variant_id
from public.raw_price_observations
limit 3;

\echo 'Inspecting public.price_history columns'
select
  column_name,
  data_type,
  is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'price_history'
order by ordinal_position;

\echo 'Running price ingestion storage smoke inserts'
begin;

do $$
begin
  if not exists (
    select 1
    from public.card_variants
    where card_id = 'EB02-061'
      and source_variant_key = 'STD'
  ) then
    raise exception 'Missing EB02-061 standard variant for price ingestion smoke test';
  end if;
end;
$$;

with target_variant as (
  select id
  from public.card_variants
  where card_id = 'EB02-061'
    and source_variant_key = 'STD'
  order by id
  limit 1
)
insert into public.raw_price_observations (
  source,
  source_listing_id,
  source_url,
  observed_at,
  parser_version,
  normalized_card_code,
  source_variant_key,
  raw_title,
  raw_condition,
  normalized_condition,
  raw_price_text,
  price_jpy,
  availability_status,
  listing_kind,
  normalized_parse_output,
  raw_text_snapshot,
  snapshot_ref,
  excluded_reason,
  match_confidence,
  matched_variant_id
)
select
  'card_rush',
  'db-smoke-eb02-061-available',
  'https://www.cardrush-op.jp/product-list?keyword=EB02-061',
  timestamptz '2099-01-01 00:00:00+00',
  'db-smoke/1',
  'EB02-061',
  'STD',
  'EB02-061 standard listing',
  'Near Mint',
  'near_mint',
  '12,345 JPY',
  12345,
  'available',
  'single_card',
  '{"condition_bucket":"near_mint","variant_treatment":"standard","canonical_eligible":true}'::jsonb,
  'db smoke raw snapshot available',
  'tests/db/raw/card-rush/eb02-061/available.json',
  null,
  'high',
  target_variant.id
from target_variant
returning
  source_listing_id,
  availability_status,
  price_jpy,
  normalized_parse_output,
  matched_variant_id;

with target_variant as (
  select id
  from public.card_variants
  where card_id = 'EB02-061'
    and source_variant_key = 'STD'
  order by id
  limit 1
)
insert into public.raw_price_observations (
  source,
  source_listing_id,
  source_url,
  observed_at,
  parser_version,
  normalized_card_code,
  source_variant_key,
  raw_title,
  raw_condition,
  normalized_condition,
  raw_price_text,
  price_jpy,
  availability_status,
  listing_kind,
  normalized_parse_output,
  raw_text_snapshot,
  snapshot_ref,
  excluded_reason,
  match_confidence,
  matched_variant_id
)
select
  'card_rush',
  'db-smoke-eb02-061-soldout',
  'https://www.cardrush-op.jp/product-list?keyword=EB02-061',
  timestamptz '2099-01-01 00:05:00+00',
  'db-smoke/1',
  'EB02-061',
  'STD',
  'EB02-061 sold out listing',
  'Sold Out',
  'unknown',
  null,
  null,
  'sold_out',
  'single_card',
  '{"condition_bucket":"unknown","variant_treatment":"standard","canonical_eligible":false,"excluded_reason":"availability_status"}'::jsonb,
  'db smoke raw snapshot sold out',
  'tests/db/raw/card-rush/eb02-061/soldout.json',
  null,
  'medium',
  target_variant.id
from target_variant
returning
  source_listing_id,
  availability_status,
  price_jpy,
  normalized_parse_output,
  matched_variant_id;

with target_variant as (
  select id
  from public.card_variants
  where card_id = 'EB02-061'
    and source_variant_key = 'STD'
  order by id
  limit 1
)
insert into public.price_history (
  variant_id,
  source,
  price_jpy,
  availability_status,
  recorded_at
)
select
  target_variant.id,
  'card_rush',
  12345,
  'available',
  timestamptz '2099-01-01 12:00:00+00'
from target_variant
returning variant_id, source, price_jpy, availability_status, recorded_at;

select
  source_listing_id,
  availability_status,
  price_jpy,
  normalized_parse_output,
  matched_variant_id
from public.raw_price_observations
where source_listing_id in (
  'db-smoke-eb02-061-available',
  'db-smoke-eb02-061-soldout'
)
order by source_listing_id;

select
  variant_id,
  source,
  price_jpy,
  availability_status,
  recorded_at
from public.price_history
where source = 'card_rush'
  and recorded_at = timestamptz '2099-01-01 12:00:00+00'
order by variant_id;

select
  count(*) as raw_observation_rows,
  count(*) filter (
    where source_listing_id = 'db-smoke-eb02-061-soldout'
      and availability_status = 'sold_out'
      and price_jpy is null
  ) as sold_out_null_price_rows,
  count(*) filter (
    where normalized_parse_output is not null
  ) as normalized_parse_output_rows
from public.raw_price_observations
where source_listing_id in (
  'db-smoke-eb02-061-available',
  'db-smoke-eb02-061-soldout'
);

select
  count(*) as canonical_price_rows,
  count(*) filter (
    where source = 'card_rush'
      and availability_status = 'available'
      and price_jpy = 12345
      and recorded_at = timestamptz '2099-01-01 12:00:00+00'
  ) as available_canonical_price_rows
from public.price_history
where source = 'card_rush'
  and recorded_at = timestamptz '2099-01-01 12:00:00+00';

rollback;
