# Proposal

## Time Log

- 2026-05-01 00:10:49 JST - Created proposal in `docs/proposals/`

## Problem

The pricing-read alignment rollout now has the intended runtime behavior, but most confidence still comes from script-level validation and a small number of manual checks. There is not yet a dedicated integration-style test layer for pricing read semantics.

That gap is risky because the current behavior depends on several exact contracts:

- `/api/prices/[cardCode]` unresolved-card `404` behavior
- row-level public history ordering and cardinality
- catalog current-price and exact-previous-day change semantics
- card-detail raw-history versus canonical-history split
- card-detail `partial` preservation when canonical series is empty but raw evidence exists

## Approach

Add dedicated backend-facing tests for pricing read behavior with mocked or fixture-backed Supabase responses.

### 1. Add a test harness for pricing readers

Cover:

- `lib/pricing/queries.ts`
- `lib/catalog/catalog.ts`
- `lib/card-detail/detail.ts`
- `app/api/prices/[cardCode]/route.ts`

The harness should make it easy to express table-driven cases without requiring live database access.

### 2. Lock the public route contract

Add tests that verify:

- unresolved card codes return `404`
- qualifying rows return `200`
- the response shape remains `{ cardCode, currency, points }`
- point ordering stays ascending by `recorded_at`
- empty qualifying history returns `points: []` rather than `404`

### 3. Lock card-detail partial behavior

Add tests that verify:

- raw in-window history can keep `chart.status` and `overview.status` at `partial`
- canonical series construction uses only qualifying rows
- `marketListings` still reads raw latest rows rather than canonical rows

### 4. Lock catalog snapshot behavior

Add tests that verify:

- `currentPriceJpy` comes from the latest qualifying canonical daily point
- `priceChange24h` compares only the exact previous JST day
- sibling-variant fallback does not silently repopulate null pricing

## Affected Areas

- `lib/pricing/queries.ts`
- `lib/catalog/catalog.ts`
- `lib/card-detail/detail.ts`
- `app/api/prices/[cardCode]/route.ts`
- a new test workspace under `tests/` or `lib/**/__tests__`

## Risks

- Choosing the wrong test level could produce brittle implementation-coupled tests.
- If the harness is too heavy, it will discourage adding future pricing cases.
- If tests rely on live Supabase, they will not be stable enough for fast validation.

## Validation

- New tests should run locally and in CI
- Existing `pnpm typecheck`
- Existing `pnpm test:deployment-readiness`
- Existing `pnpm test:price-ingestion`

## Approval

- Status: Draft

