# Proposal

## Time Log

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

### 1. Expand the committed fixture set

Add more committed manual fixtures that cover:

- multiple cards, not only `EB02-061`
- multiple default variants
- multiple JST days
- same-day competing eligible conditions
- empty-history and sparse-history cases

### 2. Keep publishing manual and repeatable

Continue to require explicit operator publishes through committed fixture JSON and `pnpm ingest:card-rush-fixture --publish`.

Do not:

- enable automated Card Rush collection
- publish ad hoc local data that is not committed as fixture evidence
- bypass the raw-observation to canonical-point to `price_history` pipeline

### 3. Define a rollout target for reader confidence

Before calling live pricing coverage healthy, define a minimum target such as:

- at least several cards with published canonical rows
- at least one card with multi-day history
- at least one card with no qualifying rows
- at least one card with non-empty catalog, detail, and `/api/prices` behavior all verified against the same publish set

### 4. Add a small coverage manifest

Introduce a lightweight manifest or doc that records which committed fixtures are expected to populate which cards, variants, and days in Supabase after publish.

That should make live coverage intentional rather than inferred from the database state.

## Affected Areas

- `tests/fixtures/price-ingestion/`
- `scripts/price-ingestion/ingest-card-rush-fixture.ts`
- `scripts/price-ingestion/lineage-coverage-audit.ts`
- `docs/reference/deployment-readiness.md`
- `docs/reference/price-ingestion-rollout.md`

## Risks

- Publishing too little data keeps product confidence artificially low.
- Publishing too much ad hoc data makes validation harder to reason about.
- If fixture evidence is not curated carefully, live coverage can become noisy rather than useful.

## Validation

- Publish each committed fixture with `pnpm ingest:card-rush-fixture --publish`
- Run `pnpm audit:pricing-lineage --window-days 35`
- Verify catalog, card detail, and `/api/prices/[cardCode]` for the cards covered by the publish set
- Confirm the coverage manifest matches the resulting published rows

## Approval

- Status: Draft

