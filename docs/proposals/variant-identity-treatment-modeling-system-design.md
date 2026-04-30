# Proposal

## Time Log

- 2026-05-01 00:10:49 JST - Created proposal in `docs/proposals/`

## Problem

The current pricing pipeline can publish canonical pricing for simple cases, but variant identity is still too weak for broader source coverage and richer matching. Stress cards such as `EB02-061` can mix:

- standard printings
- alternate art
- illustrator-specific treatments
- manga-background treatments
- graded or otherwise non-default inventory

The current `card_variants` identity model and `source_variant_key` conventions may not be rich enough to represent all treatments we eventually need to price safely.

## Approach

Design a stronger treatment-aware variant identity model before expanding pricing coverage materially.

### 1. Audit representative stress cards

Use the existing variant audit workflow to inspect cards that expose identity weaknesses, including:

- alt-art variants
- manga treatments
- illustrator-specific treatments
- product noise and non-card listings

### 2. Define explicit treatment dimensions

Review whether `card_variants` needs first-class fields for concepts such as:

- art treatment
- illustrator
- manga marker
- language or region
- graded state
- sealed or non-single-card state

### 3. Decide migration strategy

If current `source_variant_key` values such as `STD`, `P1`, and `P2` are too coarse, propose the necessary schema and data migration before enabling broader writes.

### 4. Align matcher confidence rules

Update matching expectations so ambiguous treatment matches stop before publication rather than being forced into broad variant buckets.

## Affected Areas

- `card_variants` schema and seed data
- `scripts/price-ingestion/variant-identity-audit.ts`
- pricing matcher and ingestion logic
- fixture coverage for variant-treatment ambiguity

## Risks

- Publishing against an identity model that is too broad can attach prices to the wrong treatment.
- Over-modeling too early can create a schema that is expensive to maintain.
- If treatment distinctions are implicit rather than explicit, matcher behavior will remain fragile.

## Validation

- Audit stress cards and record findings
- Add fixture cases for treatment ambiguity
- Prove that ambiguous treatment cases stop before publish
- Re-run canonical publish validation after any identity migration

## Approval

- Status: Draft

