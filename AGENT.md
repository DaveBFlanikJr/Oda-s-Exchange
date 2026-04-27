# OPTCG-Japan-Tracker (JPY)

## 1. Identity

You are helping Dave build and maintain a high-precision price intelligence service for One Piece Card Game (OPTCG) cards, specifically targeting the Tokyo secondary market in Japanese Yen (JPY).

## 2. Folder Structure

- `app/`
  - Next.js App Router entrypoints, routes, layouts, and API handlers
  - `app/page.tsx`: catalog landing page
  - `app/cards/[cardCode]/page.tsx`: card detail route
  - `app/api/cards/[cardCode]`: card detail API route
  - `app/api/prices/[cardCode]`: price history API route
- `components/`
  - Reusable UI and feature components
  - `components/CONTEXT.md`: shared frontend workspace guide for UI implementation rules
  - `components/catalog/`: product catalog and product card UI
  - `components/dashboard/`: card detail dashboard, chart, market table, and currency toggle
  - `components/providers/`: app-level providers such as React Query
  - `components/ui/`: shared shadcn/ui primitives
- `lib/`
  - Core business logic and server/client helpers
  - `lib/catalog/`: catalog data loading and fallback behavior
  - `lib/card-detail/`: card detail assembly, variant resolution, marketplace shaping, and route-specific helpers
  - `lib/pricing/`: pricing utilities, queries, mock data, and ingestion pipeline logic
  - `lib/pricing/ingestion/`: normalization, classification, validation, rules, repository access, and derived pricing types
  - `lib/scraper/`: scraper HTTP client, source definitions, and JPY parsing helpers
  - `lib/security/`: public API protections such as rate limiting
  - `lib/supabase/`: admin, public, and server Supabase clients
  - `lib/config/`: environment configuration
  - `lib/types/`: shared domain types for cards, markets, OPTCG, and price data
- `scripts/`
  - Operational scripts used for scraping, ingestion validation, seeding, and local maintenance
  - `scripts/scrape/`: scraper entrypoint and environment validation
  - `scripts/price-ingestion/`: fixture ingestion, rollout validation, and variant auditing
  - `scripts/seed/`: data repair, backfill, and seed/update utilities
  - `scripts/dev/`: local development helpers such as resetting the Next cache
- `supabase/`
  - Database schema evolution
  - `supabase/CONTEXT.md`: database workspace guide for schema, persistence, and Supabase rules
  - `supabase/migrations/`: ordered SQL migrations for pricing, variant identity, and publish metadata
- `tests/`
  - Test support and verification assets
  - `tests/db/`: smoke checks, SQL validation, and typed test helpers
  - `tests/fixtures/price-ingestion/`: fixture inputs for manual ingestion and parser coverage
- `docs/`
  - Project planning, rollout notes, incident writeups, and deployment readiness docs
- Workspace directories
  - `backend/`, `price-ingestion/`, `system-design/`, and `operations/`: workspace-specific `CONTEXT.md` guides
- `public/`
  - Static frontend assets served by Next.js
- `.github/workflows/`
  - GitHub Actions workflows, including the scheduled scraper pipeline
- Generated / external directories
  - `.next/`: local Next.js build output
  - `node_modules/`: installed dependencies
  - `.pnpm-store/`: pnpm package store

## 3. Tech Stack

- Frontend: Next.js App Router, React, and TypeScript
- Backend: TypeScript, Node.js, and Next.js Route Handlers
- Database: PostgreSQL via Supabase

## 4. Rules

- Read this file first on every new task
- Before development begins, create a proposal that outlines the intended approach, affected areas, and risks
- Before presenting the proposal for approval, send it to a senior-review sub-agent for critique and address the feedback
- If available for the task, use Codex sub-agent tooling such as `spawn_agent` to run the senior-review pass
- After reviewer feedback is addressed, present the final proposal to Dave for approval before implementation starts
- Before considering work complete, update docs if behavior changed, note what validation was performed, and call out risks if anything was not tested
- When unsure, ask

## 5. Workspaces

- `/components` - Shared frontend implementation rules for pages, components, charts, loading states, and visual patterns
- `/backend` - Shared backend decisions for API routes, server-side reads, variant resolution, and public read boundaries
- `/price-ingestion` - Data collection, normalization, classification, validation, and canonical price point generation
- `/supabase` - Schema, migrations, persistence rules, and public-read/service-write boundaries
- `/system-design` - Architecture decisions, data flow mapping, integration boundaries, and long-term platform design
- `/operations` - GitHub Actions, deployment readiness checks, Git/GitHub workflow rules, and maintenance scripts

## 6. Router

| Task | Go to | Read |
|------|-------|------|
| Work on shared UI components, layouts, charts, or styling patterns | `/components` | `CONTEXT.md` |
| Work on API routes, server-side reads, or backend behavior | `/backend` | `CONTEXT.md` |
| Work on source collection, normalization, classification, or price validation | `/price-ingestion` | `CONTEXT.md` |
| Work on schema, persistence, or Supabase access rules | `/supabase` | `CONTEXT.md` |
| Work on architecture, cross-system decisions, or data flow | `/system-design` | `CONTEXT.md` |
| Work on workflows, audits, readiness checks, Git/GitHub process, or maintenance | `/operations` | `CONTEXT.md` |

## 7. Naming Conventions

- TypeScript and TSX file names should follow the current repo convention: lowercase kebab-case when the framework does not require a special name
- Next.js special files should keep framework-required names such as `page.tsx`, `layout.tsx`, `route.ts`, and `loading.tsx`
- React component exports should use PascalCase component names even when the file name is kebab-case
- Markdown files should use lowercase kebab-case slugs: `[slug].md`
- Feature branches should use `feature/<name>`
- Update branches should use `update/<name>`
- Fix branches should use `fix/<name>`
- Branch suffixes should be short, descriptive, and lowercase kebab-case

## 8. System Design Source Of Truth

- Core constraints, cross-cutting architecture, domain model, implementation rules, security boundaries, priorities, and success metrics now live in `/system-design/CONTEXT.md`
- Use the `/system-design` workspace whenever a change affects more than one part of the platform or changes the long-term technical direction

## End of `AGENT.md`
