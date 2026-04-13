# Card Detail V2

This document describes the current card-detail implementation shipped from the shared loader in `lib/card-detail/detail.ts`.

## Summary

The card-detail flow now uses a v2 response contract with:

- one shared server contract for both page and API consumers
- section envelopes with `status`, `data`, and `meta`
- strict variant-aware resolution
- bounded JST daily price aggregation
- no synthetic market data in production responses

## Current Sources

The current server entry points are:

- `app/cards/[cardCode]/page.tsx`
- `app/api/cards/[cardCode]/route.ts`

Both call the same loader:

- `lib/card-detail/detail.ts`

## Response Shape

Top-level fields:

- `version`
- `request`
- `card`
- `activeVariant`
- `variants`
- `overview`
- `chart`
- `marketListings`

Each major data section uses the same envelope pattern:

```ts
{
  status: "ready" | "partial" | "empty" | "simulated",
  data: ...,
  meta: ...
}
```

## Request Semantics

`request` describes how variant resolution happened:

- `cardCode`
- `requestedVariantId`
- `resolvedVariantId`
- `variantResolution`

`variantResolution` is:

- `requested` when a valid `variantId` was supplied
- `defaulted` when the request used the bare card URL

## Variant Resolution Rules

- A valid `variantId` is authoritative.
- A `variantId` that belongs to a different card never resolves.
- An invalid `variantId` returns `404`.
- A bare `/cards/[cardCode]` request falls back to the default variant policy.

Internal lookup failures are tracked with these codes:

- `card_not_found`
- `variant_not_found_for_card`
- `variant_belongs_to_different_card`

## Pricing Basis

The target canonical ingestion basis is:

- `daily_best_available_ungraded_best_condition_jst`

Rules:

- Timezone is `Asia/Tokyo`.
- Data is bucketed by JST calendar day.
- Canonical rows must be linked back to raw observation evidence or authorized feed evidence.
- For each source, variant, and day, only eligible ungraded single-card observations can contribute.
- Damaged, graded, proxy/custom, sealed-only, deck-product, and ambiguous observations are excluded from default canonical UI pricing unless a later product decision creates a separate basis for them.
- For retailer sources, prefer the best available ungraded condition bucket for the source/day instead of using the naive lowest listing.
- For each JST day, the canonical day price is the minimum of those source-day values.

The older `daily_best_available_jst` rule remains the legacy description of how existing `price_history` rows are aggregated for card-detail today. New ingestion work should not write raw or condition-mixed observations directly into `price_history`; it should first store raw observations, derive the condition-aware canonical basis, and then publish only canonical points to the UI-facing series. Until derived canonical writes land, the card-detail overview and chart continue to read the legacy `price_history` series.

Noisy peer-to-peer sources such as Mercari JP must not feed the default lowest-price chart until their basis is defined. Use a separate marketplace signal, median, or trimmed-median rule only after that contract is documented and implemented.

This canonical series drives:

- `overview.data.lastPriceJpy`
- `overview.data.change1dPct`
- `overview.data.range7d`
- `chart.data`

## Metric Rules

`lastPriceJpy`

- Latest canonical daily point.

`change1dPct`

- Latest canonical JST day compared with the immediately previous JST day.
- Returns `null` when there is no exact prior-day comparison point.

`range7d`

- Low/high over the intended 7-day JST calendar window.
- Returns partial/null coverage when valid daily points are missing.

## Live Marketplace Rules

`marketListings` uses the basis:

- `latest_row_currently_available_by_source`

Rules:

- Inspect the newest row for each source.
- Include a source only when that newest row is both priced and `available`.
- Do not backfill from older available rows.

This means overview metrics and live listings are allowed to differ:

- overview is a canonical historical pricing series
- market listings are current source-specific opportunities

## Freshness Semantics

`freshnessAt` means the newest contributing observation timestamp for that section.

Examples:

- `overview.meta.freshnessAt`: newest observation used by overview metrics
- `chart.meta.freshnessAt`: newest observation represented in the chart
- `marketListings.meta.freshnessAt`: newest inspected listing row

It is not the response generation timestamp.

## Production Fallback Policy

Synthetic market data is not emitted in production.

If there is not enough real data:

- sections return `empty` or `partial`
- nullable metrics remain `null`
- UI should render empty/partial states explicitly

`simulated` is reserved for explicitly allowed non-production/demo behavior.

## UI Implications

Consumers must not assume overview metrics are always numeric.

The dashboard should:

- render nullable values safely
- avoid calling numeric formatters on `null`
- show section-specific empty or partial states
- treat `status` and `meta` as part of the contract, not optional hints

## Known Compatibility Note

The old flat card-detail shape has been replaced by the v2 envelope-based contract.

Any external consumer expecting:

- `overview.lastPriceJpy`
- `overview.change24h`
- `chart` as a bare array
- `market_listings` as a bare array

must be updated to the v2 schema.

## Verification

At the time this document was added, the implementation passed:

```bash
./node_modules/.bin/tsc --noEmit
```
