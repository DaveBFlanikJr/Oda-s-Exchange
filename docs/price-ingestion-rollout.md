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
- `raw_text_snapshot`
- `snapshot_ref`
- `excluded_reason`
- `match_confidence`
- `matched_variant_id`

The snapshot should stay minimal and scoped to the evidence needed for audits and parser fixtures.

## Canonical Derivation

The current UI contract expects latest available rows per source/day, then a cross-source reduction. That basis must be made explicit before ingestion so condition noise, graded listings, proxy listings, and deck products do not leak into the canonical market price.

Recommended guardrails:

- keep canonical rows separate from raw observations
- record condition as part of the derivation basis
- reject low-confidence matches from canonical writes
- keep ambiguous matches available for review, not automatic publication

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
