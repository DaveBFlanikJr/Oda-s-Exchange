alter table public.canonical_price_points
  drop constraint if exists canonical_price_points_raw_evidence_check;

alter table public.canonical_price_points
  add constraint canonical_price_points_raw_evidence_check check (
    (
      evidence_kind = 'raw_observation'
      and raw_observation_id is not null
    )
    or (
      evidence_kind = 'authorized_feed'
      and evidence_ref is not null
      and length(btrim(evidence_ref)) > 0
    )
  );
