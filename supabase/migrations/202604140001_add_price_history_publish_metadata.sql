alter table public.price_history
  add column if not exists canonical_price_point_id uuid
    references public.canonical_price_points(id) on delete restrict,
  add column if not exists pricing_basis public.op_canonical_pricing_basis,
  add column if not exists source_day_jst date,
  add column if not exists condition_scale public.op_condition_grade;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'price_history_canonical_publish_metadata_check'
  ) then
    alter table public.price_history
      add constraint price_history_canonical_publish_metadata_check check (
        (
          canonical_price_point_id is null
          and pricing_basis is null
          and source_day_jst is null
          and condition_scale is null
        )
        or (
          canonical_price_point_id is not null
          and pricing_basis is not null
          and source_day_jst is not null
          and condition_scale is not null
        )
      );
  end if;
end $$;

drop index if exists public.idx_price_history_hourly_dedup;

create unique index if not exists idx_price_history_legacy_hourly_dedup
  on public.price_history (
    variant_id,
    source,
    date_trunc('hour', recorded_at at time zone 'UTC')
  )
  where canonical_price_point_id is null
    and pricing_basis is null
    and source_day_jst is null
    and condition_scale is null;

create unique index if not exists idx_price_history_published_canonical_unique
  on public.price_history (
    variant_id,
    source,
    source_day_jst,
    pricing_basis
  );

create unique index if not exists idx_price_history_canonical_price_point
  on public.price_history (canonical_price_point_id)
  where canonical_price_point_id is not null;
