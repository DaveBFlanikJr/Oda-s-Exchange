# Price Data Ingestion Checklist

This checklist tracks the remaining work for gathering actual OPTCG price data and source evidence. The plan is compliance-first: do not automate collection from a source when its published policy or a missing permission path blocks that use.

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
- [ ] Add a per-source policy record before enabling any collector: policy URL, permission status, allowed collection method, rate/frequency limit, and last review date.
- [ ] Disable scheduled collection for any source whose policy is unknown, unclear, or incompatible with automated price collection.

## Raw Observation Storage

- [ ] Add a raw observation table before writing new source data into `price_history`.
- [ ] Retain enough evidence to debug bad matches later: `source`, `source_listing_id`, `source_url`, `observed_at`, `parser_version`, `normalized_card_code`, `raw_title`, `raw_condition`, `raw_price_text`, `price_jpy`, `availability_status`, `listing_kind`, `raw_text_snapshot`, `snapshot_ref`, `excluded_reason`, `match_confidence`, and `matched_variant_id`.
- [ ] Store normalized parse output, not just a hash.
- [ ] Keep durable snapshot references for manually approved fixtures and any future authorized feeds.
- [ ] Do not write low-confidence or excluded raw observations into canonical pricing outputs.

## Derived Pricing Schema

- [ ] Decide whether `price_history` remains canonical-only or is extended to include basis, condition, and raw-observation lineage.
- [ ] If condition-specific rows are stored in `price_history`, update the hourly uniqueness model so different condition/basis rows do not collide.
- [ ] Prefer a separate derived canonical table or view if `price_history` should remain simple for the UI.
- [ ] Link every canonical price point back to raw observation evidence or authorized feed evidence.
- [ ] Keep condition-specific price facts separate from canonical chart points unless the pricing basis explicitly includes that condition.

## Canonical Price Semantics

- [ ] Reconcile the current `daily_best_available_jst` contract before ingestion changes.
- [ ] Define the canonical basis in one place, for example `daily_best_available_ungraded_best_condition_jst`.
- [ ] Exclude damaged, graded, proxy/custom, sealed-only, deck-product, and ambiguous listings from default canonical UI pricing unless a product decision says otherwise.
- [ ] For retailer sources, prefer the best available ungraded condition bucket instead of the naive lowest listing.
- [ ] For noisy peer-to-peer sources, decide whether to use median, trimmed median, or a separate marketplace signal that does not feed the canonical lowest-price chart.
- [ ] Update `docs/card-detail-v2.md`, `lib/card-detail/series.ts`, and any API contracts after the canonical basis is chosen.

## Variant Identity Audit

- [ ] Confirm `card_variants` has distinct rows for every treatment we intend to price.
- [ ] Audit stress-test cards like `EB02-061` before writing prices: standard, multiple illustrator/alt-art treatments, manga-background treatment, graded copies, condition copies, and non-card/deck products.
- [ ] If current `source_variant_key` values such as `STD`, `P1`, and `P2` are not rich enough, add a variant identity migration before enabling writes.
- [ ] Define stable treatment fields, such as art treatment, illustrator, manga marker, language/region, sealed state, and grading state.
- [ ] Do not attach a price to a broad variant bucket when the source listing identifies a more specific treatment that the database cannot yet represent.

## Source Adapters

- [ ] Build source-specific adapters only after each source passes the compliance gate.
- [ ] Verify and document each source's approved collection method, listing URL shape, price field, sold-out marker, condition marker, and parse strategy.
- [ ] For Card Rush, use only manually captured fixtures until approval or authorized feed access exists.
- [ ] Keep `reference.md` updated whenever a source URL, selector, availability marker, or permission status changes.
- [ ] Persist sold-out and error observations as raw observations with `price_jpy = null`.

## Variant Matching

- [ ] Match source observations to the correct `card_variants.id`, not just the card code.
- [ ] Account for cards like `EB02-061`, where source search results can mix many card variants and treatments.
- [ ] Detect manga variants using source text markers such as `漫画背景` and `漫画絵`.
- [ ] Define alt-art matching rules separately from manga matching, since alt arts may not have a single obvious text marker.
- [ ] Use source variant key, image evidence, listing title text, illustrator text, rarity/treatment text, and known metadata together when exact variant matching is ambiguous.
- [ ] Send ambiguous variant matches to review instead of writing low-confidence prices.

## Condition And Price Quality

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
- [ ] Add a DB smoke test that inserts one valid available canonical price row.
- [ ] Add a DB smoke test that inserts one valid sold-out raw observation.
- [ ] Add a test proving valid canonical rows produce non-empty card-detail `marketListings`.
- [ ] Add fixture-based parser tests that can consume `tests/fixtures/price-ingestion/eb02-061-cases.json`.
- [ ] Cover manga, alt-art, mint, damaged, graded, sold-out, deck-product, and ambiguous examples in the fixture set.
- [ ] Update stale DB smoke SQL so it matches the current `cards` schema.
- [ ] Confirm GitHub repository secrets exist before relying on scheduled collection.

## Foundation Docs

- [x] Added `docs/price-ingestion-rollout.md` to describe compliance gating, raw observation capture, canonical derivation, and fixture rollout.
- [x] Added a lightweight fixture set at `tests/fixtures/price-ingestion/eb02-061-cases.json` for later pure-helper parser and matcher tests.
