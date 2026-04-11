create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'op_variant_suffix'
  ) then
    create type public.op_variant_suffix as enum (
      'STD',
      'AA',
      'M',
      'SP',
      'TR',
      'S',
      'DON'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'op_market_source'
  ) then
    create type public.op_market_source as enum (
      'card_rush',
      'yuyu_tei',
      'mercari_jp'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'op_availability'
  ) then
    create type public.op_availability as enum (
      'available',
      'sold_out',
      'error'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'op_card_type'
  ) then
    create type public.op_card_type as enum (
      'booster',
      'starter',
      'promo',
      'don'
    );
  end if;
end $$;

create table if not exists public.cards (
  id text primary key,
  card_set_id text not null,
  name_en text not null,
  name_jp text,
  card_type public.op_card_type not null,
  rarity_base text,
  attribute text,
  color text,
  cost integer,
  power integer,
  counter integer,
  sub_types text[] default '{}'::text[],
  text_en text,
  text_jp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cards_id_format check (id ~ '^[A-Z]{1,3}([0-9]{2})?-[0-9]{3}$'),
  constraint cards_card_set_id_format check (
    card_set_id ~ '^[A-Z]{1,3}([0-9]{2})?$'
  ),
  constraint cards_counter_nonnegative check (counter is null or counter >= 0),
  constraint cards_cost_nonnegative check (cost is null or cost >= 0),
  constraint cards_power_nonnegative check (power is null or power >= 0)
);

create table if not exists public.card_variants (
  id text primary key,
  card_id text not null references public.cards(id) on delete cascade,
  variant_type public.op_variant_suffix not null default 'STD',
  variant_rarity text not null,
  set_id text not null,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint card_variants_id_format check (
    id ~ '^[A-Z]{1,3}([0-9]{2})?-[0-9]{3}_(STD|AA|M|SP|TR|S|DON)$'
  ),
  constraint card_variants_card_id_match check (
    split_part(id, '_', 1) = card_id
  ),
  constraint card_variants_set_id_format check (
    set_id ~ '^[A-Z]{1,3}([0-9]{2})?$'
  ),
  constraint card_variants_suffix_match check (
    split_part(id, '_', 2) = variant_type::text
  ),
  constraint card_variants_business_unique unique (
    card_id,
    variant_type,
    set_id
  )
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  variant_id text not null references public.card_variants(id) on delete cascade,
  source public.op_market_source not null,
  price_jpy integer,
  availability_status public.op_availability not null default 'available',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint price_history_price_nonnegative check (
    price_jpy is null or price_jpy >= 0
  ),
  constraint price_history_price_presence_check check (
    (
      availability_status = 'available'
      and price_jpy is not null
      and price_jpy > 0
    )
    or (
      availability_status in ('sold_out', 'error')
      and price_jpy is null
    )
  )
);

create index if not exists idx_card_variants_card_id
  on public.card_variants (card_id);

create index if not exists idx_card_variants_active
  on public.card_variants (is_active)
  where is_active = true;

create index if not exists idx_price_history_variant_recorded_at
  on public.price_history (variant_id, recorded_at desc)
  include (price_jpy, source);

create index if not exists idx_price_history_source_recorded_at
  on public.price_history (source, recorded_at desc);

create unique index if not exists idx_price_history_hourly_dedup
  on public.price_history (
    variant_id,
    source,
    date_trunc('hour', recorded_at at time zone 'UTC')
  );

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_cards_updated_at on public.cards;
create trigger set_cards_updated_at
before update on public.cards
for each row
execute function public.set_updated_at();

drop trigger if exists set_card_variants_updated_at on public.card_variants;
create trigger set_card_variants_updated_at
before update on public.card_variants
for each row
execute function public.set_updated_at();

alter table public.cards enable row level security;
alter table public.card_variants enable row level security;
alter table public.price_history enable row level security;

drop policy if exists "public can read cards" on public.cards;
create policy "public can read cards"
  on public.cards
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public can read card variants" on public.card_variants;
create policy "public can read card variants"
  on public.card_variants
  for select
  to anon, authenticated
  using (true);

drop policy if exists "public can read price history" on public.price_history;
create policy "public can read price history"
  on public.price_history
  for select
  to anon, authenticated
  using (true);

drop policy if exists "service role can manage cards" on public.cards;
create policy "service role can manage cards"
  on public.cards
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role can manage card variants" on public.card_variants;
create policy "service role can manage card variants"
  on public.card_variants
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "service role can manage price history" on public.price_history;
create policy "service role can manage price history"
  on public.price_history
  for all
  to service_role
  using (true)
  with check (true);
