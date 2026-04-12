alter table public.raw_price_observations
  add column if not exists normalized_parse_output jsonb;
