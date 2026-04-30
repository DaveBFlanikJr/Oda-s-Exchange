# Deployment Readiness Runbook

This runbook covers the post-PR-7 ingestion storage and publisher foundation. The current pricing scope is Card Rush only. Card Rush remains manual-fixture only: do not run automated Card Rush scraping, do not fetch Card Rush pages from readiness jobs, and do not publish fixture-derived rows without an explicit operator command. Yuyu-Tei and Mercari JP are deferred for current pricing work.

## Migration Apply And Verify

1. Apply migrations with the deployment provider flow.
   - Supabase CLI/local: `supabase db push`
   - Hosted/provider flow: apply every pending file in `supabase/migrations/` in timestamp order.
2. Verify the migrated schema and seed state before ingestion:
   - `pnpm migrations:verify`
3. The verification gate must pass before fixture ingestion or publish-path testing. It checks that Card Rush is present in `source_compliance_records` as `restricted`, `manual_fixture`, and `scheduled_collection_enabled = false`.

## Manual Readiness Workflow

`.github/workflows/scraper.yml` is now a manual deployment-readiness workflow. It is intentionally non-scraping and has only a `workflow_dispatch` trigger.

It runs:

- `pnpm test:deployment-readiness`
- `pnpm test:price-ingestion`
- `pnpm migrations:verify`
- `pnpm typecheck`

The workflow does not install browser tooling, does not invoke `pnpm scrape`, and does not require service-role database secrets or scraper tokens. It does require `DATABASE_URL` so the migration verification smoke test can prove the schema and compliance gate are applied.

## Secrets

The readiness workflow needs only `DATABASE_URL` for the rollback migration smoke test.

Manual/local database commands need:

- `DATABASE_URL` for `pnpm migrations:verify`
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for `pnpm ingest:card-rush-fixture`

Keep service-role credentials out of browser-exposed variables and out of GitHub workflow readiness jobs.

## Manual Card Rush Fixture Ingestion

Default fixture:

`tests/fixtures/price-ingestion/card-rush-manual-ingestion-eb02-061.json`

Raw-observation ingestion only:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest:card-rush-fixture
```

Raw ingestion plus explicit publish to `price_history`:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest:card-rush-fixture --publish
```

Custom fixture path:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm ingest:card-rush-fixture --fixture tests/fixtures/price-ingestion/card-rush-manual-ingestion-eb02-061.json
```

The script reads local committed fixture JSON only. It verifies the Card Rush compliance row, resolves `card_variants` by `cardCode` and `source_variant_key`, inserts raw observations, derives canonical candidates, and publishes only when `--publish` is present.

The curated manual fixture also includes same-day competing eligible Card Rush conditions for the same variant so readiness validation can prove the default canonical publish path prefers the intended best ungraded condition before publishing to `price_history`.

## Lineage Audit Gate

Before changing emitted card-detail pricing metadata or calling the reader cutover complete, run the lineage coverage audit against the published rows you expect readers to use:

```bash
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm audit:pricing-lineage
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm audit:pricing-lineage --window-days 35
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... pnpm audit:pricing-lineage --card-code EB02-061 --window-days 35
```

The audit reports:

- visible available `price_history` rows in scope
- how many already satisfy the qualifying canonical reader predicate
- how many would be excluded
- whether exclusions are driven by missing `canonical_price_point_id`, missing `source_day_jst`, or legacy pricing-basis rows

The chosen rollout path is to keep `card-detail.v2` and flip its emitted metadata in place once this audit shows acceptable coverage for the intended rollout scope. Do not make that metadata change before the audit passes.
