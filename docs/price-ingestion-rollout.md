# Price Ingestion Rollout

This note captures the foundation for price ingestion work without changing production code. Under the current project scope, Card Rush is the only active pricing source, and it remains manual-fixture only until an approved data-use path or authorized feed exists. It is meant to keep later parser helpers, matcher helpers, and canonical derivation logic pointed at the same rules.

## Rollout Order

1. Confirm source compliance before any automated collection.
2. Capture raw observations before trying to canonicalize prices.
3. Derive canonical prices from raw observations only after the basis is formalized.
4. Keep fixture-driven parser and matcher tests separate from production writes until the helper layer exists.

## Compliance Gate

Each source needs a policy record before collection is enabled.

Minimum fields:

- policy URL
- permission status
- allowed collection method
- rate or frequency limit
- last review date

Card Rush stays fixture-only until an approved data-use path or authorized feed exists.
Yuyu-Tei and Mercari JP are deferred for current pricing work.

## Raw Observation Shape

Raw observations should preserve enough evidence to explain a later match or rejection.

Recommended fields:

- `source`
- `source_listing_id`
- `source_url`
- `observed_at`
- `parser_version`
- `normalized_card_code`
- `raw_title`
- `raw_condition`
- `raw_price_text`
- `price_jpy`
- `availability_status`
- `listing_kind`
- `normalized_parse_output`
- `raw_text_snapshot`
- `snapshot_ref`
- `excluded_reason`
- `match_confidence`
- `matched_variant_id`

The snapshot should stay minimal and scoped to the evidence needed for audits and parser fixtures.
Normalized parser output should carry the structured parse summary needed to reproduce condition, variant-treatment, listing-kind, and exclusion decisions without storing a larger raw page snapshot.

## Canonical Derivation

The target canonical ingestion contract is `daily_best_available_ungraded_best_condition_jst`: eligible raw observations are grouped by variant, source, and JST day, source/day candidates prefer the best ungraded condition bucket, and the canonical day price is the minimum across eligible source/day values. Damaged, graded, proxy/custom, sealed-only, deck-product, and ambiguous observations stay out of this default basis unless a separate product decision defines how to show them. Current card-detail overview and chart reads still use the legacy `price_history` aggregation until derived canonical writes land.

Recommended guardrails:

- keep canonical rows separate from raw observations
- record condition as part of the derivation basis
- reject low-confidence matches from canonical writes
- keep ambiguous matches available for review, not automatic publication
- keep non-Card Rush sources out of the canonical lowest-price chart under the current scope until a later source contract is explicitly approved and documented

## Fixture Rollout

The fixture set in `tests/fixtures/price-ingestion/eb02-061-cases.json` is intentionally small and representative.

It should cover:

- standard cards
- manga variants with markers like `漫画背景` and `漫画絵`
- alt-art listings
- condition-sensitive listings
- graded listings
- sold-out rows
- deck or product noise
- ambiguous matches that should be rejected

Later pure-helper tests can load those fixtures without needing any production imports.

## Deployment Readiness

Deployment readiness is gated by migration verification before any fixture write:

1. Apply migrations with `supabase db push` or the provider migration flow.
2. Run `pnpm migrations:verify`.
3. Run manual fixture ingestion only from committed fixture JSON.

The manual Card Rush fixture path is `pnpm ingest:card-rush-fixture`. It reads `tests/fixtures/price-ingestion/card-rush-manual-ingestion-eb02-061.json` by default, requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, verifies Card Rush remains `restricted` / `manual_fixture` / unscheduled, writes raw observations, derives canonical candidates, and publishes to `price_history` only with `--publish`.

The GitHub readiness workflow is manual-only and non-scraping. It does not install browser tooling, does not call `pnpm scrape`, and does not receive service-role write credentials. It runs `pnpm migrations:verify` with `DATABASE_URL` so stale migration state is caught before manual fixture work.
