do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'op_source_permission_status'
  ) then
    create type public.op_source_permission_status as enum (
      'unknown',
      'pending',
      'approved',
      'restricted',
      'denied'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'op_source_collection_method'
  ) then
    create type public.op_source_collection_method as enum (
      'unknown',
      'manual_fixture',
      'authorized_feed',
      'api',
      'html_scrape'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'op_raw_listing_kind'
  ) then
    create type public.op_raw_listing_kind as enum (
      'unknown',
      'single_card',
      'graded_card',
      'sealed_product',
      'deck_product',
      'proxy_custom',
      'ambiguous'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'op_condition_grade'
  ) then
    create type public.op_condition_grade as enum (
      'unknown',
      'mint',
      'near_mint',
      'light_play',
      'moderate_play',
      'damaged',
      'graded'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'op_match_confidence'
  ) then
    create type public.op_match_confidence as enum (
      'low',
      'medium',
      'high',
      'excluded'
    );
  end if;
end $$;

create table if not exists public.source_compliance_records (
  id uuid primary key default gen_random_uuid(),
  source public.op_market_source not null unique,
  policy_url text not null,
  permission_status public.op_source_permission_status not null default 'unknown',
  allowed_collection_method public.op_source_collection_method not null default 'unknown',
  collection_frequency_minutes integer,
  rate_limit_note text not null default '',
  scheduled_collection_enabled boolean not null default false,
  last_reviewed_at date not null default current_date,
  review_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint source_compliance_records_collection_frequency_positive check (
    collection_frequency_minutes is null or collection_frequency_minutes > 0
  ),
  constraint source_compliance_records_rate_limit_note_trimmed check (
    char_length(rate_limit_note) <= 500
  ),
  constraint source_compliance_records_review_notes_trimmed check (
    char_length(review_notes) <= 2000
  ),
  constraint source_compliance_records_schedule_guard check (
    not scheduled_collection_enabled
    or (
      permission_status = 'approved'
      and allowed_collection_method in ('authorized_feed', 'api', 'html_scrape')
      and collection_frequency_minutes is not null
    )
  )
);

create table if not exists public.raw_price_observations (
  id uuid primary key default gen_random_uuid(),
  source public.op_market_source not null,
  source_listing_id text not null,
  source_url text not null,
  observed_at timestamptz not null default now(),
  parser_version text not null,
  normalized_card_code text not null,
  source_variant_key text,
  raw_title text,
  raw_condition text,
  normalized_condition public.op_condition_grade not null default 'unknown',
  raw_price_text text,
  price_jpy integer,
  availability_status public.op_availability not null default 'available',
  listing_kind public.op_raw_listing_kind not null default 'unknown',
  raw_text_snapshot text,
  snapshot_ref text not null,
  excluded_reason text,
  match_confidence public.op_match_confidence not null default 'low',
  matched_variant_id text references public.card_variants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint raw_price_observations_normalized_card_code_format check (
    normalized_card_code ~ '^[A-Z]{1,3}([0-9]{2})?-[0-9]{3}$'
  ),
  constraint raw_price_observations_source_variant_key_trimmed check (
    source_variant_key is null or char_length(source_variant_key) <= 128
  ),
  constraint raw_price_observations_price_nonnegative check (
    price_jpy is null or price_jpy >= 0
  ),
  constraint raw_price_observations_price_presence_check check (
    (
      availability_status = 'available'
      and price_jpy is not null
      and price_jpy > 0
    )
    or (
      availability_status in ('sold_out', 'error')
      and price_jpy is null
    )
  ),
  constraint raw_price_observations_snapshot_scope check (
    raw_text_snapshot is null or char_length(raw_text_snapshot) <= 8192
  ),
  constraint raw_price_observations_excluded_reason_check check (
    match_confidence <> 'excluded'
    or excluded_reason is not null
  )
);

create index if not exists idx_source_compliance_records_scheduled_collection_enabled
  on public.source_compliance_records (scheduled_collection_enabled)
  where scheduled_collection_enabled = true;

create index if not exists idx_source_compliance_records_permission_status
  on public.source_compliance_records (permission_status);

create index if not exists idx_raw_price_observations_source_listing
  on public.raw_price_observations (source, source_listing_id);

create index if not exists idx_raw_price_observations_source_card_observed_at
  on public.raw_price_observations (source, normalized_card_code, observed_at desc)
  include (price_jpy, availability_status, listing_kind, match_confidence, matched_variant_id);

create index if not exists idx_raw_price_observations_source_variant_observed_at
  on public.raw_price_observations (source, source_variant_key, observed_at desc)
  where source_variant_key is not null;

create index if not exists idx_raw_price_observations_matched_variant_observed_at
  on public.raw_price_observations (matched_variant_id, observed_at desc)
  where matched_variant_id is not null;

create index if not exists idx_raw_price_observations_unmatched_observed_at
  on public.raw_price_observations (source, observed_at desc)
  where matched_variant_id is null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_source_compliance_records_updated_at on public.source_compliance_records;
create trigger set_source_compliance_records_updated_at
before update on public.source_compliance_records
for each row
execute function public.set_updated_at();

drop trigger if exists set_raw_price_observations_updated_at on public.raw_price_observations;
create trigger set_raw_price_observations_updated_at
before update on public.raw_price_observations
for each row
execute function public.set_updated_at();

alter table public.source_compliance_records enable row level security;
alter table public.raw_price_observations enable row level security;

drop policy if exists "service role can manage source compliance records" on public.source_compliance_records;
create policy "service role can manage source compliance records"
  on public.source_compliance_records
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role can manage raw price observations" on public.raw_price_observations;
create policy "service role can manage raw price observations"
  on public.raw_price_observations
  for all
  to service_role
  using (true)
  with check (true);
