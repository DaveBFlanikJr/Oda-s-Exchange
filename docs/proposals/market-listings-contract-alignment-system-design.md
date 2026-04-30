# Proposal

## Time Log

- 2026-05-01 00:10:49 JST - Created proposal in `docs/proposals/`

## Problem

The pricing-read alignment rollout intentionally left `marketListings` out of scope. That was the right cut line, but it means card-detail still has two different pricing-related contracts:

- overview/chart use qualifying canonical published history
- `marketListings` uses latest-row-per-source availability inspection from raw `price_history` rows

That split is documented, but not yet re-evaluated as a product contract. We still need to decide whether `marketListings` should remain a distinct latest-row surface or whether it needs tighter alignment with canonical lineage, source rules, or future inventory-specific data structures.

## Approach

Run a dedicated contract review for `marketListings` rather than changing it opportunistically.

### 1. Document the intended product meaning

Decide whether `marketListings` is meant to show:

- the latest currently available listing by source
- the best currently available listing by source
- a curated source-of-truth inventory signal
- something else entirely

### 2. Review data-source fitness

Determine whether `price_history` is still the right source for `marketListings`, or whether listings should eventually come from:

- raw observations
- a separate current-inventory table
- a derived listing snapshot table

### 3. Revisit fallback and freshness rules

Explicitly decide:

- whether older available rows should ever backfill missing current rows
- whether unavailable latest rows should suppress older available evidence
- whether freshness thresholds should affect section status

### 4. Define alignment boundaries with overview/chart

Preserve intentional differences where they are product-driven, but make them explicit so future work does not treat `marketListings` and canonical chart pricing as interchangeable.

## Affected Areas

- `lib/card-detail/marketplace.ts`
- `lib/card-detail/detail.ts`
- `docs/reference/card-detail-v2.md`
- any future marketplace or inventory schema proposal

## Risks

- Tightening `marketListings` too quickly could hide useful current inventory.
- Leaving it underspecified keeps future drift likely.
- Using canonical chart history as a shortcut for listing output would blur different product meanings.

## Validation

- Add targeted `marketListings` behavior tests once the contract is approved
- Verify examples where overview/chart and listings intentionally disagree
- Verify freshness and availability edge cases explicitly

## Approval

- Status: Draft

