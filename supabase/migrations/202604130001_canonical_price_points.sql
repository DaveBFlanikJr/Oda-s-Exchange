do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'op_canonical_pricing_basis'
  ) then
    create type public.op_canonical_pricing_basis as enum (
      'daily_best_available_jst',
      'daily_best_available_ungraded_best_condition_jst'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'op_price_evidence_kind'
  ) then
    create type public.op_price_evidence_kind as enum (
      'raw_observation',
      'authorized_feed'
    );
  end if;
end $$;

create table if not exists public.canonical_price_points (
  id uuid primary key default gen_random_uuid(),
  variant_id text not null references public.card_variants(id) on delete cascade,
  source public.op_market_source not null,
  source_day_jst date not null,
  pricing_basis public.op_canonical_pricing_basis not null,
  condition_scale public.op_condition_grade not null,
  price_jpy integer not null,
  observed_at timestamptz not null,
  evidence_kind public.op_price_evidence_kind not null default 'raw_observation',
  raw_observation_id uuid references public.raw_price_observations(id) on delete restrict,
  evidence_ref text,
  selection_rank integer not null default 0,
  selection_reason text not null default '',
  derivation_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint canonical_price_points_price_positive check (
    price_jpy > 0
  ),
  constraint canonical_price_points_selection_rank_nonnegative check (
    selection_rank >= 0
  ),
  constraint canonical_price_points_raw_evidence_check check (
    (
      evidence_kind = 'raw_observation'
      and raw_observation_id is not null
    )
    or evidence_kind = 'authorized_feed'
  )
);

create unique index if not exists idx_canonical_price_points_source_day_basis
  on public.canonical_price_points (
    variant_id,
    source,
    source_day_jst,
    pricing_basis
  );

create index if not exists idx_canonical_price_points_variant_day
  on public.canonical_price_points (variant_id, source_day_jst desc);

create index if not exists idx_canonical_price_points_variant_basis_day
  on public.canonical_price_points (
    variant_id,
    pricing_basis,
    source_day_jst desc
  )
  include (price_jpy, source, observed_at, condition_scale);

create index if not exists idx_canonical_price_points_raw_observation
  on public.canonical_price_points (raw_observation_id)
  where raw_observation_id is not null;

create index if not exists idx_canonical_price_points_source_day
  on public.canonical_price_points (source, source_day_jst desc);

drop trigger if exists set_canonical_price_points_updated_at on public.canonical_price_points;
create trigger set_canonical_price_points_updated_at
before update on public.canonical_price_points
for each row
execute function public.set_updated_at();

alter table public.canonical_price_points enable row level security;

drop policy if exists "service role can manage canonical price points" on public.canonical_price_points;
create policy "service role can manage canonical price points"
  on public.canonical_price_points
  for all
  to service_role
  using (true)
  with check (true);
