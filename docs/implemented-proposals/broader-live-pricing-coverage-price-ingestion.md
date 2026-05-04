# Proposal

## Time Log

- 2026-05-04 17:43:22 JST - Implemented and moved to `docs/implemented-proposals/` after the broader live pricing coverage rollout merged, the coverage manifest and committed fixture set were in place, and readiness validation passed
- 2026-05-01 17:50:31 JST - Revised proposal after review feedback and moved to `docs/approved/`
- 2026-05-01 00:10:49 JST - Created proposal in `docs/proposals/`

## Problem

The pricing-read alignment rollout is now implemented, but live published coverage is still minimal. The current Supabase validation path was proven with a single manually published Card Rush fixture row, which is enough to validate the reader contract but not enough to represent real catalog, detail, and public API behavior across multiple cards, variants, and days.

That leaves product and operational risk:

- catalog pricing can still look sparse even though the read path is correct
- `/api/prices/[cardCode]` is only lightly exercised against live data
- card-detail overview/chart semantics have not been proven across a representative coverage set
- future regressions may be harder to distinguish from simple lack of published rows

## Approach

Broaden live pricing coverage through a controlled manual-fixture publishing workflow, without reintroducing scraping or bypassing compliance constraints.

### 1. Gate scope to treatment-safe coverage first

This rollout should not be treated as permission to publish every variant shape that can be expressed in fixtures.

Until the treatment-aware variant identity work is complete, this proposal should expand coverage only for treatment-safe default variants whose `source_variant_key` mapping is already well understood.

Do not use this rollout to publish:

- ambiguous treatment matches
- stress cards whose variant identity is still under review
- alternate-art, manga, illustrator-specific, graded, sealed, or otherwise non-default inventory that depends on stronger treatment modeling

Broader publishing for those cases should wait on the variant-identity proposal and any resulting schema or matcher changes.

### 2. Expand the committed fixture set within that safe scope

Add more committed manual fixtures that cover:

- multiple cards, not only `EB02-061`
- multiple treatment-safe default variants
- multiple JST days
- same-day competing eligible conditions
- empty-history and sparse-history cases

### 3. Keep publishing manual and repeatable

Continue to require explicit operator publishes through committed fixture JSON and `pnpm ingest:card-rush-fixture --publish`.

Do not:

- enable automated Card Rush collection
- publish ad hoc local data that is not committed as fixture evidence
- bypass the raw-observation to canonical-point to `price_history` pipeline

### 4. Define a rollout target for reader confidence

Before calling live pricing coverage healthy, define a minimum target such as:

- at least several cards with published canonical rows
- at least one card with multi-day history
- at least one card with no qualifying rows
- at least one card with non-empty catalog, detail, and `/api/prices` behavior all verified against the same publish set

Do not call coverage healthy based on manual publish checks alone.

The backend pricing-read integration test work should be treated as a prerequisite or required parallel deliverable for this rollout, so route, catalog, and card-detail pricing contracts are also locked in CI.

### 5. Add a small coverage manifest plus reconciliation rules

Introduce a lightweight manifest or doc that records which committed fixtures are expected to populate which cards, variants, source days, and pricing-basis keys in Supabase after publish.

That manifest should not stand alone as prose. The rollout should also define how expected coverage is reconciled against current database state, because canonical points and published rows are upserted into persistent tables rather than isolated by a named publish batch.

At minimum, define one of:

- a baseline/reset rule for the environment used for publish verification
- a constrained publish window with explicit assumptions about pre-existing rows
- lightweight tooling that compares expected fixture outputs against actual canonical and published rows

That should make live coverage intentional rather than inferred from whichever rows happen to be present.

## Affected Areas

- `tests/fixtures/price-ingestion/`
- `scripts/price-ingestion/ingest-card-rush-fixture.ts`
- `scripts/price-ingestion/lineage-coverage-audit.ts`
- backend pricing-read integration tests under `tests/` or `lib/**/__tests__`
- `docs/reference/deployment-readiness.md`
- `docs/reference/price-ingestion-rollout.md`

## Risks

- Expanding coverage before treatment-safe scope is defined can attach prices to the wrong variant.
- Publishing too little data keeps product confidence artificially low.
- Publishing too much ad hoc data makes validation harder to reason about.
- If fixture evidence is not curated carefully, live coverage can become noisy rather than useful.

## Validation

- Publish each committed fixture with `pnpm ingest:card-rush-fixture --publish`
- Run `pnpm audit:pricing-lineage --window-days 35`
- Land backend pricing-read integration coverage and run it in CI before calling live coverage healthy
- Verify catalog, card detail, and `/api/prices/[cardCode]` for the cards covered by the publish set
- Confirm the coverage manifest or reconciliation tooling matches the resulting canonical and published rows under the chosen baseline assumptions

## Implementation

- Status: Implemented
- Merged by PR #17 in `80b2514`.
- Implemented coverage uses committed Card Rush manual fixtures and the coverage manifest at `tests/fixtures/price-ingestion/card-rush-manual-publish-coverage.json`.
- Local completion validation on 2026-05-04 passed `pnpm test:price-ingestion`, `pnpm test:pricing-read`, `pnpm test:deployment-readiness`, `pnpm typecheck`, and `pnpm migrations:verify`.
