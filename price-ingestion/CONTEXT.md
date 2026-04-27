# Price Ingestion Workspace Context

Last updated: 2026-04-27

## Identity

This workspace covers the data pipeline from raw marketplace collection through validated, normalized, and canonical pricing data that can be trusted by the app.

## Primary Source Areas

- `lib/scraper/`
- `scripts/scrape/`
- `lib/pricing/ingestion/`
- `scripts/price-ingestion/`
- `.github/workflows/scraper.yml`
- `tests/fixtures/price-ingestion/`

## Reference Docs

- `docs/price-data-ingestion-checklist.md` for ingestion validation expectations and rollout checks
- `docs/price-ingestion-rollout.md` for rollout sequencing, known risks, and adoption notes
- `docs/live-marketplace-incident-report.md` for source-quality and marketplace incident context
- Load these only when the task needs deeper rollout history, validation criteria, or incident background

## Responsibilities

- Collect raw listings from Japanese market sources
- Enforce JPY-only extraction during collection and parsing
- Normalize raw source payloads into stable internal structures
- Classify variants and identities correctly
- Validate suspicious or incomplete price observations
- Produce canonical price points that downstream catalog and detail experiences can trust
- Support repeatable fixture-driven verification

## Collection Rules

- Tooling: Playwright with Node.js via `pnpm`
- Execution target: GitHub Actions on a JST cron schedule
- Schedule target: `0 0 * * *` JST
- Scraping should remain internal to GitHub Actions or protected operational flows
- Manual runs should use controlled workflow inputs
- Overlapping scraper runs should be prevented with workflow concurrency controls

## Pipeline Rules

- Canonical pricing data should be derived from validated marketplace observations, not ad hoc UI fallbacks
- Price ingestion should support the same shared pricing source of truth used by catalog and card-detail surfaces
- Fixture-driven validation should cover real parsing edge cases before rollout

## Rules

- Parse and store market prices as JPY
- Flag materially suspicious under-market observations instead of trusting them blindly
- Keep pricing logic centralized and reusable
- Fixture coverage should reflect real source edge cases whenever possible

## Testing Expectations

- Changes to collection, normalization, classification, or canonical price generation should include or update relevant validation before merge
- Parser and ingestion logic should be covered by fixture-driven checks wherever practical
- Keep ingestion fixtures under `tests/fixtures/price-ingestion/`
- Test or validation files should use lowercase kebab-case and end with `.test.ts` when they are standard TypeScript tests
- If a change is validated only through scripts or manual inspection, document exactly what was run and what risk remains
