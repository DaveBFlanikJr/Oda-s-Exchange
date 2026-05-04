# Price Ingestion Workspace Context

Last updated: 2026-04-30

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

- `docs/CONTEXT.md` is the docs entrypoint for folder meanings, naming, proposal lifecycle, and where stable reference docs now live
- After opening `docs/CONTEXT.md`, use the relevant files under `docs/reference/` for rollout history, validation criteria, and incident background only when needed

## Responsibilities

- Collect raw listings from approved Japanese market sources, with Card Rush as the only active pricing source under the current project scope
- Enforce JPY-only extraction during collection and parsing
- Normalize raw source payloads into stable internal structures
- Classify variants and identities correctly
- Validate suspicious or incomplete price observations
- Produce canonical price points that downstream catalog and detail experiences can trust
- Support repeatable fixture-driven verification

## Collection Rules

- Tooling: Playwright with Node.js via `pnpm`
- Current active source scope: Card Rush only
- Current execution target: controlled manual fixture ingestion for Card Rush
- Scheduled collection remains disabled for Card Rush until an approved data-use path or authorized feed exists
- Scraping should remain internal to GitHub Actions or protected operational flows
- Manual runs should use controlled workflow inputs
- Overlapping scraper runs should be prevented with workflow concurrency controls

## Pipeline Rules

- Canonical pricing data should be derived from validated marketplace observations, not ad hoc UI fallbacks
- Current published pricing work should stay Card Rush-only until project scope changes
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

## Documentation Expectations

- Keep ingestion rollout and checklist docs in sync with real pipeline behavior
- If the task starts or changes a proposal, follow `docs/CONTEXT.md`
