# Price Data Ingestion Checklist

This checklist tracks the remaining work for gathering actual OPTCG price data and source evidence. The plan is compliance-first: do not automate collection from a source when its published policy or a missing permission path blocks that use.

## Project Note

Card Rush is the intended source of card price data. The ingestion work must preserve prices by card condition now, and expose condition-specific views later, not collapse every listing into one undifferentiated price. Matching is equally important: each Card Rush listing must connect to the correct card and variant already stored in our database before any price is published.

## Current Foundation

- [x] Supabase stores prices at the `card_variants` grain through `price_history`.
- [x] Public reads and service-role writes are separated by RLS.
- [x] Card detail v2 reads variant-level history and builds overview, chart, and live marketplace sections from real rows.
- [x] GitHub Actions scraper workflow exists with singleton concurrency and manual trigger protection.
- [x] Scraper scaffolding exists for Card Rush, Yuyu-Tei, and Mercari JP.
- [x] Known scraper schema drift is documented in `docs/live-marketplace-incident-report.md`.

## Source Compliance Gate

- [ ] Record Card Rush policy URL before any related work: `https://cardrush.media/data_policy`.
- [ ] Do not run automated Card Rush scraping until a permitted data-use path is confirmed.
- [ ] Contact Card Rush through their published data-use/partnership path before using Card Rush price data in an automated collector.
- [ ] Treat Card Rush as a manually captured fixture source only until approval or an authorized feed exists.
- [x] Seed `source_compliance_records` for Card Rush, Yuyu-Tei, and Mercari JP with cautious defaults; Card Rush remains `restricted` and `manual_fixture` only, with scheduled collection disabled until approval or an authorized feed exists.
- [x] Add per-source policy records before enabling any collector: policy URL, permission status, allowed collection method, rate/frequency limit, and last review date.
- [x] Disable scheduled collection for any source whose policy is unknown, unclear, or incompatible with automated price collection.

## Raw Observation Storage

- [x] Add a raw observation table before writing new source data into `price_history`.
- [x] Retain enough evidence to debug bad matches later: `source`, `source_listing_id`, `source_url`, `observed_at`, `parser_version`, `normalized_card_code`, `raw_title`, `raw_condition`, `raw_price_text`, `price_jpy`, `availability_status`, `listing_kind`, `raw_text_snapshot`, `snapshot_ref`, `excluded_reason`, `match_confidence`, and `matched_variant_id`.
- [x] Store normalized parse output, not just a hash.
- [ ] Keep durable snapshot references for manually approved fixtures and any future authorized feeds.
- [x] Do not write low-confidence or excluded raw observations into canonical pricing outputs.

## Derived Pricing Schema

- [x] Decide whether `price_history` remains canonical-only or is extended to include basis, condition, and raw-observation lineage.
- [x] Keep `price_history` as the UI compatibility table while publishing only default canonical points into it.
- [x] Add `canonical_price_points` as the derived canonical table for basis, condition, and lineage.
- [x] Add publish metadata to `price_history`, scope legacy UTC-hour dedupe to unpublished rows, and use `unique (variant_id, source, source_day_jst, pricing_basis)` for idempotent canonical publishing.
- [x] Link every canonical price point back to raw observation evidence or authorized feed evidence; authorized-feed rows require a durable non-empty `evidence_ref`.
- [ ] Keep condition-specific price facts separate from canonical chart points unless the pricing basis explicitly includes that condition.

## Canonical Price Semantics

- [x] Reconcile the legacy `daily_best_available_jst` card-detail contract before switching consumers to the new ingestion basis.
- [x] Define the canonical basis in one place, for example `daily_best_available_ungraded_best_condition_jst`.
- [x] Exclude damaged, graded, proxy/custom, sealed-only, deck-product, and ambiguous listings from default canonical UI pricing unless a product decision says otherwise.
- [x] For retailer sources, prefer the best available ungraded condition bucket instead of the naive lowest listing.
- [x] For noisy peer-to-peer sources such as Mercari JP, keep them out of the default canonical lowest-price chart until a separate marketplace signal, median, or trimmed-median basis is explicitly defined.
- [ ] Update `lib/card-detail/series.ts` and any API contracts after derived canonical writes land.

## Variant Identity Audit

- [ ] Confirm `card_variants` has distinct rows for every treatment we intend to price.
- [ ] Audit stress-test cards like `EB02-061` before writing prices: standard, multiple illustrator/alt-art treatments, manga-background treatment, graded copies, condition copies, and non-card/deck products.
- [ ] If current `source_variant_key` values such as `STD`, `P1`, and `P2` are not rich enough, add a variant identity migration before enabling writes.
- [ ] Define stable treatment fields, such as art treatment, illustrator, manga marker, language/region, sealed state, and grading state.
- [ ] Do not attach a price to a broad variant bucket when the source listing identifies a more specific treatment that the database cannot yet represent.

## Source Adapters

- [ ] Treat Card Rush as the primary intended price data source, subject to the compliance gate.
- [ ] Build source-specific adapters only after each source passes the compliance gate.
- [ ] Verify and document each source's approved collection method, listing URL shape, price field, sold-out marker, condition marker, and parse strategy.
- [ ] For Card Rush, use only manually captured fixtures until approval or authorized feed access exists.
- [ ] Keep `reference.md` updated whenever a source URL, selector, availability marker, or permission status changes.
- [ ] Persist sold-out and error observations as raw observations with `price_jpy = null`.
- [x] Disable the stale `scripts/scrape/index.ts` path so it cannot write directly to `price_history` and bypass the raw-to-derived boundary.
- [x] Document that the current GitHub Actions scraper workflow will fail fast until it is replaced with a compliant raw-observation ingestion job or disabled for deployment.

## Variant Matching

- [ ] Connect each Card Rush listing to the correct existing database card and `card_variants.id` before publishing prices.
- [ ] Match source observations to the correct `card_variants.id`, not just the card code.
- [ ] Account for cards like `EB02-061`, where source search results can mix many card variants and treatments.
- [ ] Detect manga variants using source text markers such as `漫画背景` and `漫画絵`.
- [ ] Define alt-art matching rules separately from manga matching, since alt arts may not have a single obvious text marker.
- [ ] Use source variant key, image evidence, listing title text, illustrator text, rarity/treatment text, and known metadata together when exact variant matching is ambiguous.
- [ ] Send ambiguous variant matches to review instead of writing low-confidence prices.

## Condition And Price Quality

- [ ] Preserve Card Rush condition-specific prices in raw/derived storage.
- [ ] Expose supported condition-specific prices in the UI after the storage contract is stable.
- [ ] Capture card condition from source listings when available.
- [ ] Normalize conditions into a shared scale, for example mint, near-mint, light-play, moderate-play, damaged, graded, and unknown.
- [ ] Treat condition as price-affecting evidence: mint condition should not be mixed blindly with damaged prices.
- [ ] Decide the canonical market price basis per source, such as best available near-mint-or-better listing, cheapest mint-or-better listing, or separate condition buckets.
- [ ] Store or derive enough condition metadata to prevent damaged-card listings from dragging down the canonical price.
- [ ] Add outlier checks that consider condition, because a damaged card can be legitimately much cheaper than a mint card.

## Product And API Alignment

- [ ] Decide whether live marketplace should remain strict: latest row per source only, no older fallback.
- [ ] Align `/api/prices/[cardCode]` with the card-detail v2 pricing basis or mark it as legacy.
- [ ] Remove deterministic catalog mock pricing once real `price_history` coverage is sufficient.
- [ ] Keep catalog and detail pages aligned to the same pricing source of truth.

## Verification

- [ ] Add schema tests for raw observation storage.
- [x] Add a DB smoke test that inserts one valid available canonical price row.
- [x] Add a DB smoke test that inserts one valid sold-out raw observation.
- [x] Add a DB smoke test that publishes raw-backed canonical points into `price_history` idempotently through the default basis/source/day key.
- [ ] Add a test proving published default canonical rows in `price_history` produce non-empty card-detail overview, chart, and `marketListings`.
- [x] Add fixture-based parser tests that can consume `tests/fixtures/price-ingestion/eb02-061-cases.json`.
- [x] Cover manga, alt-art, mint, damaged, graded, sold-out, deck-product, and ambiguous examples in the fixture set.
- [x] Update stale DB smoke SQL so it matches the current `cards` schema.
- [ ] Confirm GitHub repository secrets exist before relying on scheduled collection.

## Foundation Docs

- [x] Added `docs/price-ingestion-rollout.md` to describe compliance gating, raw observation capture, canonical derivation, and fixture rollout.
- [x] Added a lightweight fixture set at `tests/fixtures/price-ingestion/eb02-061-cases.json` for later pure-helper parser and matcher tests.
