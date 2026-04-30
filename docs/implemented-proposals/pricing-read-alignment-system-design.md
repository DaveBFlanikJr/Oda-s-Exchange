# Proposal

## Time Log

- 2026-05-01 01:18:00 JST - Moved proposal to `docs/implemented-proposals/` after publishing canonical fixture data, passing the lineage audit gate, and completing the metadata cutover
- 2026-05-01 01:12:00 JST - Completed the live fixture publish, passed the lineage audit gate, updated card-detail emitted pricing metadata to the canonical basis, and prepared the proposal for move to `docs/implemented-proposals/`
- 2026-05-01 00:41:00 JST - Implemented the shared pricing-read helper, `/api/prices` alignment, catalog alignment, card-detail dual-read split, lineage coverage audit tooling, and documented the chosen staged card-detail compatibility path while leaving the live audit/backfill gate outstanding
- 2026-04-30 23:42:38 JST - Moved proposal to `docs/approved/` after approval
- 2026-04-30 23:38:41 JST - Revised proposal to define the `/api/prices` lookup seam with a discriminated pricing-read result so unknown-card `404` behavior is implementable without duplicate route lookups
- 2026-04-30 23:32:20 JST - Revised proposal to lock card-detail overview partial-state behavior and define `/api/prices/[cardCode]` unresolved-card semantics
- 2026-04-30 23:27:29 JST - Revised proposal to require an explicit card-detail contract compatibility decision and to lock the dual-read split between raw detail history and qualifying canonical history
- 2026-04-30 23:23:07 JST - Revised proposal to lock raw-vs-qualified read boundaries, preserve `/api/prices` ordering/cardinality, define catalog current-price semantics, and require card-detail pricing metadata updates during cutover
- 2026-04-30 23:17:59 JST - Revised proposal after follow-up review to preserve card-detail partial states, define catalog change semantics, and add a data-audit/backfill gate before reader cutover
- 2026-04-30 23:14:49 JST - Revised proposal after review to define canonical `price_history` read semantics, narrow `marketListings` scope, and clarify `/api/prices` behavior
- 2026-04-30 23:05:01 JST - Updated reference doc links after moving stable documentation into `docs/reference/`
- 2026-04-30 23:00:36 JST - Added proposal to `docs/proposals/` and recorded the initial revised draft in the docs proposal flow

## Problem

The pricing stack still has three different public-read behaviors drifting apart:

- Card detail uses the newer variant-aware v2 loader and section-envelope response model.
- `/api/prices/[cardCode]` serves a simpler historical series with a separate query path.
- Catalog pricing computes its own snapshot logic and can fall back to sibling-variant rows in [lib/catalog/catalog.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/catalog/catalog.ts:1).

That drift creates product and architectural risk. We could restore Supabase and still have catalog, detail, and public API disagree about what “current price” or “historical price” means. We also still have deterministic mock fallback behavior in the public pricing path, which conflicts with the repo’s stated direction of replacing temporary pricing behavior with a consistent real-data contract.

This work matters now because it is mostly offline-safe while Supabase is being restored. We can use this window to align pricing read behavior, remove fake-data assumptions from production paths, and strengthen fixture-driven confidence before any live publish flow resumes.

## Approach

This proposal is a compatibility-first pricing-read alignment pass.

### 1. Keep `/api/prices/[cardCode]` backward-compatible for now

`/api/prices/[cardCode]` should keep the current response shape:

```ts
{
  cardCode: string;
  currency: "JPY";
  points: Array<{ timestamp: string; priceJpy: number }>;
}
```

We should not silently turn it into a v2 card-detail response or a different semantic contract in the same endpoint. Instead:

- keep its shape stable
- document it as the current legacy public default-variant historical-series endpoint
- align its data basis with the shared pricing-read logic underneath
- consider a versioned replacement later if we want a richer contract

This lowers rollout risk while still letting us fix the underlying inconsistency.

### 2. Remove deterministic mock fallback from public pricing reads

The current public pricing path falls back to [lib/pricing/mock-data.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/pricing/mock-data.ts:1) when Supabase is unavailable.

That behavior should be removed from production-facing read paths. The proposal distinguishes between "no published data" and "backend failure":

- if a read succeeds and there are no qualifying published rows, return an explicit empty state
- if Supabase is unavailable or the query fails, preserve an error path rather than returning a valid-looking empty payload

This keeps missing data honest without hiding backend outages.

Planned behavior:

- `/api/prices/[cardCode]` returns `404` when `cardCode` resolves to no variant
- `/api/prices/[cardCode]` returns an empty `points` array only when the read succeeds but no qualifying history exists
- `/api/prices/[cardCode]` continues to fail on backend/query errors until an explicit operational error contract is designed
- catalog pricing returns `null` fields when there is no real data
- card detail continues to use explicit `empty` or `partial` section states rather than synthetic values

This keeps “no data” honest, preserves operational observability, and makes downstream UI assumptions visible instead of hidden.

To make that behavior implementable without duplicating route lookups, the public pricing read helper should return a discriminated result rather than a bare points array. The intended contract is:

```ts
type PublicPriceHistoryResult =
  | { status: "not_found"; cardCode: string }
  | {
      status: "ok";
      cardCode: string;
      resolvedVariantId: string;
      points: Array<{ timestamp: string; priceJpy: number }>;
    };
```

With that contract:

- the helper owns default-variant resolution
- the route returns `404` when `status === "not_found"`
- the route returns `200` with `points: []` only when `status === "ok"` and the resolved variant has no qualifying history

### 3. Centralize shared pricing-read logic in `lib/pricing`

We should introduce or reshape a narrow shared helper layer under `@/lib/pricing` that exposes reusable pricing-read DTOs without coupling all consumers to one UI contract.

That shared layer should support:

- public historical series for `/api/prices`
- latest/current snapshot needs for catalog
- canonical historical inputs for card detail

For canonical-history readers, the helper must define the exact `price_history` read semantics instead of relying on implicit table conventions.

The proposal should distinguish between:

- a raw variant history window used for card-detail status and edge-specific logic
- a qualifying canonical-history subset used for canonical series and aligned public history reads

The raw history window should preserve the current card-detail ability to distinguish `partial` from `empty`. It should load all rows for the resolved variant within the requested time window, including rows that do not qualify for canonical series construction.

Card detail overview/chart must continue to derive section status from that raw in-window history set. The qualifying canonical-history subset is an input to canonical series construction, not a replacement for the broader history evidence card detail uses to distinguish `partial` from `empty`.

For card detail specifically, the dual-read contract should be explicit:

- raw in-window variant history remains the source for section-status evidence and `marketListings` freshness/availability inspection
- qualifying canonical-history rows are used only for overview/chart series construction and related derived metrics

The implementation should not replace all card-detail reads with the filtered canonical subset.

Overview status needs one additional explicit rule during this split:

- if raw in-window history exists but the qualifying canonical daily series is empty, `chart.status` should remain `partial`
- in that same situation, `overview.status` should also remain `partial`, not `empty`

That preserves the current meaning of "we saw recent pricing evidence, but not enough qualifying canonical data to populate the overview metrics."

The qualifying canonical-history subset should read only rows that meet all of the following conditions:

- `variant_id` matches the resolved target variant
- `pricing_basis = 'daily_best_available_ungraded_best_condition_jst'`
- `canonical_price_point_id is not null`
- `source_day_jst is not null`
- `availability_status = 'available'`
- `price_jpy is not null`

That predicate makes the intended read semantics explicit once `price_history` contains both legacy rows and canonical published rows. Rows outside that predicate remain relevant for some edge behaviors, especially card-detail section-status derivation, but they are out of scope for canonical series construction unless a later proposal defines a separate compatibility fallback.

It should not own:

- card-detail section envelopes
- marketplace/latest-row listing rules
- page-specific response formatting

Those remain edge concerns in their current modules so we do not accidentally tie chart logic, live-listing logic, and public route formatting together.

### 4. Define `/api/prices/[cardCode]` semantics, not just its shape

For this pass, `/api/prices/[cardCode]` should be defined as:

- a legacy public endpoint
- returning historical points for the card's default variant
- using the same canonical-history predicate described above
- preserving row-level point granularity rather than folding to one point per JST day
- preserving ascending `recorded_at` ordering in the returned `points` array
- returning `404` when the supplied `cardCode` resolves to no variant

It is not a card-level aggregate endpoint.

Its default-variant resolution must be documented explicitly. Until a versioned replacement exists, the endpoint should resolve the target variant using a stable default policy, matching current behavior unless intentionally changed:

1. variant with `source_variant_key = 'STD'`
2. otherwise variant with `variant_type = 'STD'`
3. otherwise the first ordered variant for the card

If future product requirements need variant-aware public history, that should be a new endpoint or an explicit contract revision rather than an unspoken behavior change inside this legacy route.

The implementation seam should follow the discriminated helper result described above rather than adding a second variant-existence lookup in the route. That keeps variant resolution, defaulting behavior, and not-found semantics inside one pricing-read path.

### 5. Define catalog snapshot and change semantics explicitly

Catalog is in scope for this alignment pass, so its price metrics need a defined contract rather than an implicit reuse of whichever rows happen to be loaded.

For this proposal, catalog should be defined as:

- variant-strict for current price
- canonical-history based for the displayed price
- day-over-day aligned with card detail for change semantics

That means:

- `currentPriceJpy` should come from the latest JST day point of the variant's qualifying canonical daily series, not from the newest raw row
- `priceChange24h` should not use the latest two raw rows
- `priceChange24h` should compare the latest qualifying JST day point to the exact previous JST day point, matching the card-detail overview comparison rule

If no exact previous JST day point exists, `priceChange24h` should be `null`.

This keeps catalog and card detail aligned at the metric-definition level rather than only at the storage-read level.

### 6. Bring catalog pricing into scope

The senior review correctly flagged that catalog pricing drift cannot be ignored if the goal is aligned public pricing behavior.

Catalog currently:

- loads variant rows
- fetches `price_history`
- computes current price and price change independently
- can fall back from a variant’s own rows to sibling rows from the same card

That sibling fallback is especially risky because it can make a variant appear priced even when that exact variant has no pricing evidence.

This proposal brings catalog into scope so we can either:

- align it to the same shared pricing-read basis as the other public surfaces, or
- explicitly define a temporary contract if some catalog behavior must remain transitional

The default direction is to remove sibling-variant fallback and prefer explicit `null` pricing when the selected variant has no qualifying canonical-history rows of its own.

### 7. Keep `marketListings` out of scope for this alignment pass

This proposal does not change the `marketListings` source-of-truth contract.

`marketListings` currently uses the separate basis documented in [docs/reference/card-detail-v2.md](/Users/daveflanik/Desktop/Oda’s-Exchange/docs/reference/card-detail-v2.md:1):

- latest row per source
- current availability only
- no older-row backfill

That is a different read problem than canonical overview/chart history. The shared canonical-history helper proposed here should not be treated as the source of truth for `marketListings`, and this proposal should not claim that canonical published rows alone are sufficient to validate marketplace output.

If we later decide that `marketListings` should read from a different structure or apply lineage-aware filtering, that should be handled in a separate proposal.

### 8. Add a data-audit and backfill gate before reader cutover

Because the qualifying canonical-history subset requires `canonical_price_point_id is not null`, reader cutover cannot be treated as a code-only refactor.

Before any public reader switches to the lineage-aware predicate by default, the rollout must include:

1. a data audit that measures how many currently visible rows would be excluded by the new predicate
2. a decision on whether existing legacy rows are acceptable to hide
3. any required backfill or republish step to populate canonical lineage for rows we still intend to serve
4. a cutover checkpoint confirming that the aligned readers will not accidentally make large portions of pricing appear empty

This is a gating step, not a nice-to-have follow-up.

### 9. Update card-detail pricing metadata when overview/chart semantics change

If card-detail overview/chart switch from the current legacy basis to the lineage-aware canonical basis, the response metadata must change in the same rollout.

That includes:

- updating the card-detail pricing-basis constant away from `daily_best_available_jst`
- updating `overview.meta.pricingBasis`
- updating `chart.meta.pricingBasis`
- updating any related docs that still describe the legacy basis as the active runtime contract

The implementation should not improve the underlying read semantics while leaving emitted metadata on the legacy basis label.

### 10. Make an explicit card-detail compatibility decision before changing the emitted basis

Changing `overview.meta.pricingBasis` and `chart.meta.pricingBasis` from the legacy basis to the lineage-aware canonical basis is a public contract change, even if the response shape stays the same.

This proposal should not treat that as an automatic in-place update to `card-detail.v2`. Before cutover, the rollout must choose one of these paths explicitly:

1. accept the basis change inside `card-detail.v2` and document that existing consumers are expected to adopt the corrected semantics without a version bump
2. introduce an explicit versioned contract change, such as a new response version or successor endpoint/contract, if compatibility risk is not acceptable

The default posture for this proposal is compatibility-first: do not silently change the emitted card-detail pricing basis without recording which path was chosen and why.

Chosen path for this rollout:

- path 1: accept the basis change inside `card-detail.v2` without introducing a new response version
- rationale: the response shape is already stable, the runtime overview/chart readers are already aligned to the qualifying canonical predicate, and introducing a new endpoint/version before validating live lineage coverage would add contract surface without reducing current implementation risk
- rollout constraint: the emitted metadata label must still remain on the legacy value until the lineage audit/backfill gate confirms acceptable coverage for the intended rollout scope
- follow-up: once the audit passes, update the emitted `pricingBasis` metadata and related docs in the same cutover pass rather than carrying a long-lived semantic mismatch

### 11. Preserve condition-aware and canonical pricing boundaries

This proposal does not change the ingestion contract or flatten raw facts into UI-facing series.

The following boundaries remain intact:

- raw observations stay separate from canonical published history
- condition-aware matching and canonical selection remain in the ingestion layer
- default UI pricing continues to follow the canonical basis described in docs
- we do not simplify public reads by reintroducing mixed-condition or mixed-source shortcuts

The goal here is read-path alignment, not a rewrite of canonical derivation semantics.

## Affected Areas

### Likely code changes

- [app/api/prices/[cardCode]/route.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/app/api/prices/[cardCode]/route.ts:1)
- [lib/pricing/queries.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/pricing/queries.ts:1)
- [lib/pricing/mock-data.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/pricing/mock-data.ts:1)
- [lib/catalog/catalog.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/catalog/catalog.ts:1)
- [lib/card-detail/detail.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/card-detail/detail.ts:1)
- [lib/card-detail/repository.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/card-detail/repository.ts:1)

### Reference logic that should stay aligned

- [lib/pricing/ingestion/derive.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/pricing/ingestion/derive.ts:1)
- [lib/pricing/ingestion/classifier.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/pricing/ingestion/classifier.ts:1)
- [docs/reference/card-detail-v2.md](/Users/daveflanik/Desktop/Oda’s-Exchange/docs/reference/card-detail-v2.md:1)
- [docs/reference/price-ingestion-rollout.md](/Users/daveflanik/Desktop/Oda’s-Exchange/docs/reference/price-ingestion-rollout.md:1)
- [docs/reference/price-data-ingestion-checklist.md](/Users/daveflanik/Desktop/Oda’s-Exchange/docs/reference/price-data-ingestion-checklist.md:1)

### Validation and readiness surfaces

- [scripts/price-ingestion/validate-fixtures.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/scripts/price-ingestion/validate-fixtures.ts:1)
- [scripts/price-ingestion/validate-deployment-readiness.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/scripts/price-ingestion/validate-deployment-readiness.ts:1)

## Risks

### Behavioral risks

- `/api/prices` consumers may be relying on current shape and current empty-data behavior, so semantics must not drift without an explicit plan.
- Removing mock fallback will expose real empty states that may surface hidden UI assumptions.
- Removing catalog sibling fallback may cause more cards or variants to show `null` pricing in the short term.
- If the canonical read predicate is implemented incorrectly, aligned readers can still mix legacy and canonical rows while appearing structurally unified.
- If card detail loses access to raw non-qualifying rows, `partial` states can incorrectly collapse into `empty`.
- If overview status is not explicitly tied to preserved raw-history evidence, card detail can regress to `overview: empty` while `chart: partial`.
- If catalog current-price semantics are left at raw-row freshness instead of canonical daily-point freshness, catalog and card detail can still disagree on the same variant.
- If `/api/prices` changes point granularity or ordering during refactor, consumers can break even if the JSON shape stays the same.
- If `/api/prices` not-found behavior is implemented with ad hoc route-side checks instead of a single helper contract, variant resolution and history-read semantics can drift apart again.
- If the card-detail basis label changes in place without an explicit compatibility decision, consumers can receive a semantic contract change without any clear upgrade signal.
- Leaving `marketListings` on a separate basis is intentional, but it means read-path alignment remains partial until that contract is reviewed independently.

### Data and migration risks

- This work should not require a schema change by itself, but it depends on the meaning of `price_history` remaining consistent with current canonical publishing expectations.
- Until Supabase is back, we cannot fully validate that the aligned readers behave correctly against live restored rows.

### Rollout risks

- If route, catalog, and detail are not updated together, we could temporarily make the inconsistency worse instead of better.
- If docs are not updated in the same pass, future work may keep treating `/api/prices` as equivalent to card detail when it is not.

### Unknowns needing review before implementation

- Whether any external or frontend consumer depends on the current deterministic mock behavior
- Whether `/api/prices` should eventually be superseded by a versioned endpoint rather than evolved further
- Whether catalog should remain variant-strict or support any card-level fallback at all
- Whether any existing data backfill is needed before the canonical read predicate can safely exclude legacy rows by default
- Whether the data audit will show enough lineage-covered rows to permit immediate cutover, or whether a staged rollout is required
- Whether any external consumer currently depends on the legacy `200` + empty payload behavior for unresolved card codes

## Validation

### Automated checks

- Run `pnpm test:price-ingestion`
- Run `pnpm test:deployment-readiness`
- Run `pnpm typecheck`

### Tests to add or extend

- Verify `/api/prices/[cardCode]` returns an empty `points` array when the read succeeds but no qualifying canonical-history rows exist
- Verify `/api/prices/[cardCode]` keeps its backward-compatible response shape
- Verify `/api/prices/[cardCode]` preserves row-level granularity and ascending `recorded_at` ordering
- Verify `/api/prices/[cardCode]` returns `404` when `cardCode` resolves to no variant
- Verify the public pricing helper returns a discriminated result that cleanly separates `not_found` from `ok` with empty history
- Verify `/api/prices/[cardCode]` reads only rows that match the canonical-history predicate and does not mix legacy/unpublished rows into the returned series
- Verify `/api/prices/[cardCode]` preserves an error path on Supabase/query failure instead of collapsing backend failure into an empty response
- Verify card-detail status derivation still receives enough raw history to distinguish `partial` from `empty`
- Verify card detail continues using raw in-window history for `marketListings` inspection and section-status evidence
- Verify card-detail overview stays `partial` rather than `empty` when raw in-window history exists but the qualifying canonical series is empty
- Verify catalog pricing for a variant with no own qualifying rows does not silently inherit sibling pricing unless explicitly intended
- Verify catalog `currentPriceJpy` comes from the latest qualifying canonical daily point rather than the newest raw row
- Verify catalog `priceChange24h` uses exact previous JST day semantics rather than the latest two raw rows
- Verify card-detail read behavior still preserves explicit `empty` or `partial` section semantics
- Add or extend tests proving published canonical rows can drive non-empty overview and chart responses
- Keep `marketListings` verification separate, using its current latest-row-per-source contract rather than the canonical-history helper
- Add a rollout validation step or audit script that measures how many visible rows would be excluded by the lineage-aware predicate before cutover
- Verify card-detail response metadata reports the updated pricing basis once overview/chart reads switch to canonical published rows

### Manual checks

- Confirm no production-facing canonical-history read path silently substitutes deterministic mock prices
- Confirm catalog, detail overview/chart, and `/api/prices` behave consistently for the same variant assumptions and canonical-history predicate
- Confirm `marketListings` behavior remains unchanged and was not accidentally coupled to the canonical-history helper
- Confirm card detail still shows `partial` rather than `empty` when only non-qualifying in-window rows exist
- Confirm unresolved card codes return `404` from `/api/prices/[cardCode]` rather than a successful empty payload
- Confirm card-detail response metadata advertises the same pricing basis the implementation actually reads
- Confirm the chosen card-detail compatibility path is documented before rollout

### Post-Supabase-restoration checks

Once Supabase is available again:

- Run `pnpm migrations:verify`
- Run the manual fixture ingestion path
- Run the data audit for lineage coverage before switching readers
- Perform any required backfill or republish step identified by that audit
- Verify catalog, card detail overview/chart, and `/api/prices` against the same test card after publish
- Confirm the aligned readers reflect the expected canonical basis, lineage-aware read predicate, and empty-state behavior
- Verify `marketListings` separately against its current latest-row-per-source contract

## Execution Order

1. Document and lock the intended `/api/prices` compatibility contract, including unresolved-card `404` behavior.
2. Document and lock the raw-history vs qualifying-canonical-history split for readers.
3. Document and lock `/api/prices` row granularity, ordering, and helper return semantics.
4. Document and lock catalog current-price and `priceChange24h` semantics.
5. Run a data audit for lineage coverage and decide whether backfill or republish is required before cutover.
6. Document and lock the canonical-history `price_history` read predicate.
7. Design the shared pricing-read helper in `lib/pricing` with separate support for raw history windows and qualifying canonical-history subsets, and with a discriminated result for public price history lookups.
8. Refactor `/api/prices` to use shared qualifying canonical-history reads without changing shape, granularity, or ordering.
9. Remove deterministic mock fallback from the public read path while preserving error behavior for backend failures.
10. Align catalog pricing to the same qualifying predicate and JST-day comparison rules, and remove sibling fallback unless explicitly retained by design.
11. Lock the card-detail dual-read contract: raw history for listings/status, qualifying canonical history for overview/chart.
12. Verify card-detail overview/chart remains edge-specific and keeps enough raw history to preserve `partial` states.
13. Make and document the explicit card-detail compatibility decision before changing emitted pricing-basis metadata.
14. Update card-detail pricing-basis metadata in the same rollout that changes overview/chart read semantics.
15. Keep `marketListings` on its current contract and do not expand scope implicitly.
16. Add tests for route behavior, predicate behavior, catalog behavior, partial-vs-empty behavior, metadata accuracy, unresolved-card behavior, helper discriminated-result behavior, and no-data vs backend-failure behavior.
17. Update docs so pricing-basis and public-contract expectations are explicit.

## Approval

- Senior reviewer feedback:
  - Include catalog drift in scope or explicitly defer it
  - Define `/api/prices` compatibility plan before implementation
  - Add validation for route behavior, catalog behavior, and no-data behavior

- Reviewer concerns addressed:
  - Catalog is now explicitly in scope
  - `/api/prices` is defined as compatibility-first and shape-stable for this pass
  - Canonical `price_history` read semantics are now explicit instead of implied
  - `marketListings` is explicitly kept out of this alignment scope
  - Card-detail partial-state preservation is now explicit in the reader design
  - Catalog current-price and change semantics are now defined instead of implied
  - A data-audit/backfill gate is now required before reader cutover
  - `/api/prices` compatibility now explicitly includes granularity and ordering, not only shape
  - `/api/prices` unresolved-card behavior is now explicit instead of falling through to an empty success payload
  - `/api/prices` now has an explicit helper return contract so not-found and empty-history behavior can be implemented without duplicate route lookups
  - Card-detail pricing metadata is now required to change with the underlying overview/chart basis
  - Card detail now has an explicit dual-read contract instead of an implied shared-helper cutover
  - Card-detail overview `partial` semantics are now explicitly preserved when raw history exists but canonical series is empty
  - Card-detail basis changes now require an explicit compatibility decision rather than a silent in-place contract mutation
  - Validation now includes predicate behavior and distinguishes no-data from backend failure

- Final approval from Dave:
  - Approved on 2026-04-30 23:42:38 JST
