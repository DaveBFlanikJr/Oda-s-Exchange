insert into public.source_compliance_records (
  source,
  policy_url,
  permission_status,
  allowed_collection_method,
  collection_frequency_minutes,
  rate_limit_note,
  scheduled_collection_enabled,
  last_reviewed_at,
  review_notes
)
values
  (
    'card_rush',
    'https://cardrush.media/data_policy',
    'restricted',
    'manual_fixture',
    null,
    'No automated Card Rush scraping or crawling for price collection until permission or an authorized feed is confirmed.',
    false,
    current_date,
    'Card Rush remains manual-fixture only until an approved data-use path or authorized feed exists.'
  ),
  (
    'yuyu_tei',
    'https://yuyu-tei.jp/',
    'unknown',
    'unknown',
    null,
    'Policy page not yet identified; keep scheduled collection disabled until compliance review is complete.',
    false,
    current_date,
    'Homepage recorded for compliance tracking only. No automated collection enabled yet.'
  ),
  (
    'mercari_jp',
    'https://jp.mercari.com/',
    'unknown',
    'unknown',
    null,
    'Policy page not yet identified; keep scheduled collection disabled until compliance review is complete.',
    false,
    current_date,
    'Homepage recorded for compliance tracking only. No automated collection enabled yet.'
  )
on conflict (source) do update
set policy_url = excluded.policy_url,
    permission_status = excluded.permission_status,
    allowed_collection_method = excluded.allowed_collection_method,
    collection_frequency_minutes = excluded.collection_frequency_minutes,
    rate_limit_note = excluded.rate_limit_note,
    scheduled_collection_enabled = excluded.scheduled_collection_enabled,
    last_reviewed_at = excluded.last_reviewed_at,
    review_notes = excluded.review_notes,
    updated_at = now();
