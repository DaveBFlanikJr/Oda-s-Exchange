# Live Marketplace Incident Report

## Summary

The Live Marketplace panel is not primarily failing in the UI layer. The break appears to come from a data-pipeline mismatch between the current dashboard contract and the scraper ingestion code.

Primary cause:

- The dashboard reads `price_history` using the current schema: `variant_id`, `source`, `price_jpy`, `availability_status`, and `recorded_at`.
- The scraper still attempts to insert legacy fields: `card_code`, `source_name`, and `source_type`.

If `scripts/scrape/index.ts` is the active ingest path, new marketplace rows cannot land in the shape the dashboard expects, which leaves the Live Marketplace section empty.

## Evidence

### 1. The dashboard depends on current `price_history` rows

The detail loader queries `price_history` by exact variant id and builds both chart data and live listings from that result set:

- [lib/card-detail/detail.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/card-detail/detail.ts#L234)
- [lib/card-detail/detail.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/card-detail/detail.ts#L263)

Important behavior:

- It filters on `.eq("variant_id", resolvedVariant.row.id)`.
- Live listings are derived only from the latest row per source for that variant.

### 2. The UI correctly renders empty state when no valid rows exist

The Live Marketplace card simply shows "No current listings found" when `listings.length === 0`:

- [components/dashboard/card-detail-terminal.tsx](/Users/daveflanik/Desktop/Oda’s-Exchange/components/dashboard/card-detail-terminal.tsx#L312)

This means the UI is behaving as designed. It is not the source of the break.

### 3. The database schema requires modern fields

`price_history` is defined with:

- `variant_id`
- `source`
- `price_jpy`
- `availability_status`
- `recorded_at`

See:

- [supabase/migrations/202604060001_init.sql](/Users/daveflanik/Desktop/Oda’s-Exchange/supabase/migrations/202604060001_init.sql#L114)

### 4. The scraper writes the wrong shape

The scraper inserts this payload:

- `card_code`
- `price_jpy`
- `source_name`
- `source_type`

See:

- [scripts/scrape/index.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/scripts/scrape/index.ts#L31)

That does not match the table definition the dashboard depends on.

## Secondary Contributing Factors

### Strict variant-level lookup

The detail page uses the exact selected variant id when reading `price_history`:

- [lib/card-detail/detail.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/card-detail/detail.ts#L237)

So even if there is data for sibling variants of the same card, this page will not use it.

### Strict live-listing policy

The product rules explicitly say:

- inspect the newest row for each source
- include it only if that newest row is `available`
- do not backfill older available rows

See:

- [docs/card-detail-v2.md](/Users/daveflanik/Desktop/Oda’s-Exchange/docs/card-detail-v2.md#L112)

This makes the panel highly sensitive to ingestion gaps. A single stale or missing newest row turns into an empty marketplace state.

### Catalog can still look healthier than the detail page

The catalog has a sibling-variant fallback when pricing a card:

- [lib/catalog/catalog.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/catalog/catalog.ts#L179)

That means the catalog can still show prices while the detail dashboard appears broken, which can make this feel like a dashboard-only regression even when the underlying issue is data ingestion.

## Most Likely Root Cause

The most likely root cause is schema drift in the live scrape pipeline:

1. The app evolved to a variant-aware `price_history` model.
2. The scraper still writes an older card-level payload.
3. The detail dashboard now relies on variant-level rows and a strict "latest available only" listing rule.
4. Result: the Live Marketplace panel empties out because it receives no usable rows.

## Recommended Fix

### Immediate fix

Update the scraper pipeline so every insert into `price_history` uses the current schema:

- resolve the target `card_variants.id`
- write `variant_id`
- write `source`
- write `availability_status`
- write `recorded_at`
- stop writing legacy fields that are not part of the table

### Hardening fix

Add ingestion validation so the pipeline fails fast when payloads no longer match the active schema.

Recommended checks:

- typed insert payloads based on [lib/types/optcg.ts](/Users/daveflanik/Desktop/Oda’s-Exchange/lib/types/optcg.ts)
- a DB smoke test that inserts one valid `price_history` row end-to-end
- a test that verifies the detail loader returns non-empty `marketListings` when valid rows exist

### Product decision to confirm

Decide whether the Live Marketplace panel should remain strict.

Current behavior is internally consistent, but brittle:

- newest row unavailable => source disappears
- missing exact variant rows => panel empties

If that strictness is intentional, the ingestion fix is enough.
If not, a later product change could allow fallback to the latest available row or to sibling-variant data.

## Confidence And Limits

Confidence is high on the code-level cause because the read path and write path clearly disagree.

Limit:

- I did not verify the live Supabase contents directly from this environment, so I cannot prove whether bad inserts are failing outright or whether rows are simply missing in production.

## Verification Notes

TypeScript app check completed successfully with:

```bash
./node_modules/.bin/tsc --noEmit
```

No application code was changed as part of this report.
