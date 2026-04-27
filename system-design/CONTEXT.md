# System Design Workspace Context

Last updated: 2026-04-27

## Identity

This workspace covers the architectural view of the app. It is the place for shaping system boundaries, documenting data flow, and making design decisions that connect the frontend, ingestion pipeline, scraper, and database into one coherent platform.

## Current Project

We are building a high-precision price intelligence service for the Japanese One Piece Card Game secondary market. The app combines a Next.js catalog and card detail experience with a scraper, a price ingestion pipeline, and a Supabase-backed data model, all centered on Tokyo-market pricing in JPY. Under the current project scope, Card Rush is the only active pricing source, and it remains manual-fixture only until an approved data-use path or authorized feed exists. The current focus is turning the existing pipeline and UI into a consistent end-to-end pricing platform that can replace temporary fallback behavior with real market intelligence.

## Core Constraints

- Primary currency: JPY
- Active pricing source: Card Rush only under the current project scope
- Deferred pricing sources: Yuyu-Tei and Mercari JP
- Package manager: Strictly `pnpm`; do not use `npm` or `yarn`
- HTTP client: Strictly `axios@1.14.0`
- Cost efficiency: Target $0/month infrastructure using Vercel, Supabase, and GitHub Actions
- Security: Enforce zero-public-write access to prevent unauthorized database manipulation

## What Good Looks Like

- Catalog and card detail pages derive pricing from the same trusted domain logic
- Scraped marketplace data is normalized, validated, and stored in a way the frontend can rely on
- JPY remains the canonical currency across ingestion, storage, and display decisions
- Public read access is safe, while writes stay protected behind GitHub Actions or server-side boundaries
- The architecture stays understandable enough that future changes do not reintroduce duplicated pricing logic or inconsistent data flow

## What To Avoid

- Scattering pricing rules across routes, components, scripts, and SQL without a clear source of truth
- Exposing write paths, privileged keys, or scraper triggers to public clients
- Treating temporary mock pricing as a permanent product behavior
- Building catalog and card detail flows on separate pricing assumptions
- Letting docs drift away from the real implementation

## Primary Source Areas

- `AGENT.md`
- `docs/`
- `components/CONTEXT.md`
- `backend/CONTEXT.md`
- `price-ingestion/CONTEXT.md`
- `supabase/CONTEXT.md`
- `operations/CONTEXT.md`

## Reference Docs

- `docs/repository-migration-report.md` for prior repository-structure changes and migration context
- `system-design/repository-structure-migration-plan.md` for the current phased plan to improve frontend/backend boundaries
- `system-design/proposal-template.md` for new feature or refactor proposals before implementation starts
- `docs/card-detail-v2.md` for deeper card-detail architecture and behavior notes
- Load these only when the task needs historical detail or a deeper design reference

## Responsibilities

- Define and document how catalog, card detail, ingestion, scraping, and persistence fit together
- Capture architectural tradeoffs before major implementation work begins
- Clarify ownership boundaries between frontend, backend, ingestion, and operations concerns
- Keep high-level data flow and system assumptions understandable for future contributors

## Rules

- Prefer design decisions that preserve JPY as the canonical pricing currency
- Keep pricing logic centralized instead of scattering business rules across routes and components
- Maintain secure boundaries between public-read surfaces and protected write paths
- Treat architecture docs as living references that should match the current implementation

## System Architecture

- Marketplace sources are collected, normalized, and validated through `/price-ingestion`
- Canonical card, variant, and price records are stored through `/supabase`
- Shared backend loaders and APIs in `/backend` assemble read models for the app
- Shared UI rules in `/components` support the catalog and card-detail app surfaces
- `/operations` owns workflow execution, readiness checks, and rollout support

## Workspace Boundaries

- `/components` owns shared UI and presentation rules
- `/backend` owns server-side reads, public APIs, and backend coordination rules
- `/price-ingestion` owns source collection, normalization, classification, and canonical price generation
- `/supabase` owns schema and persistence boundaries
- `/operations` owns automation and operational safety nets

## Near-Term Priorities

- Replace temporary catalog mock pricing with real populated price intelligence data
- Keep current pricing work centered on Card Rush-backed published data
- Build a dedicated price intelligence service that returns:
  - current price
  - previous price
  - 24h change
  - source snapshots
  - chart points
- Keep catalog and detail pages aligned to the same pricing source of truth
- Continue keeping pricing and formatting logic centralized under `@/lib/pricing`

## Success Metrics

- Verification: Stored JPY price points match Card Rush listings within an acceptable margin for the current scope
- Cost: Stay within $0/month free-tier limits for Vercel and Supabase
- Robustness: Card Rush ingestion handles out-of-stock states without breaking charts or detail views
- Consistency: Catalog and card detail pricing derive from the same domain logic
