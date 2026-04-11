alter table public.card_variants
  add column if not exists source_record_id text,
  add column if not exists source_variant_key text;

update public.card_variants
set
  source_variant_key = case
    when variant_type = 'STD' then 'STD'
    when variant_type = 'AA' then 'P1'
    when variant_type = 'M' then 'P2'
    else variant_type::text
  end,
  source_record_id = case
    when variant_type = 'STD' then card_id
    when variant_type = 'AA' then card_id || '_p1'
    when variant_type = 'M' then card_id || '_p2'
    else card_id || '_' || lower(variant_type::text)
  end
where source_record_id is null or source_variant_key is null;

alter table public.card_variants
  alter column source_record_id set not null,
  alter column source_variant_key set not null;

alter table public.card_variants
  drop constraint if exists card_variants_id_format,
  drop constraint if exists card_variants_suffix_match,
  drop constraint if exists card_variants_business_unique;

alter table public.card_variants
  add constraint card_variants_id_format check (
    id ~ '^[A-Z]{1,3}([0-9]{2})?-[0-9]{3}_[A-Z0-9]+$'
  ),
  add constraint card_variants_source_record_id_unique unique (source_record_id),
  add constraint card_variants_business_unique unique (
    card_id,
    source_variant_key,
    set_id
  );

create index if not exists idx_card_variants_card_id_source_variant_key
  on public.card_variants (card_id, source_variant_key);
