# Price Ingestion Rollout

This note captures the foundation for price ingestion work without changing production code. It is meant to keep later parser helpers, matcher helpers, and canonical derivation logic pointed at the same rules.

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

The default UI contract is `daily_best_available_ungraded_best_condition_jst`: eligible raw observations are grouped by variant, source, and JST day, source/day candidates prefer the best ungraded condition bucket, and the canonical day price is the minimum across eligible source/day values. Damaged, graded, proxy/custom, sealed-only, deck-product, and ambiguous observations stay out of this default basis unless a separate product decision defines how to show them.

Recommended guardrails:

- keep canonical rows separate from raw observations
- record condition as part of the derivation basis
- reject low-confidence matches from canonical writes
- keep ambiguous matches available for review, not automatic publication
- keep noisy peer-to-peer sources separate from the canonical lowest-price chart until median or trimmed-median semantics are chosen

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
