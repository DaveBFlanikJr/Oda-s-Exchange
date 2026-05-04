# Backend Workspace Context

Last updated: 2026-04-30

## Identity

This workspace covers shared backend and server-side application behavior. Use it when making decisions about API routes, server data loading, variant resolution, public read boundaries, or backend coordination between the frontend and Supabase.

## Workspace Use

- `/backend/` is a routing workspace, not the main implementation directory
- The actual backend code primarily lives in `lib/` and `app/api/`
- Use this file to decide which backend area to open, then load only the smallest relevant set of files for the task
- Do not pull broad backend context by default when a task only touches one feature path or one route

## Primary Source Areas

- `app/api/`
- `lib/card-detail/`
- `lib/catalog/`
- `lib/pricing/`
- `lib/security/`
- `lib/supabase/server-client.ts`
- `docs/`

## Reference Docs

- `docs/CONTEXT.md` is the docs entrypoint for folder meanings, naming, proposal lifecycle, and where stable reference docs now live
- Load docs when a backend contract, API shape, or pricing-read policy changes

## Responsibilities

- Define public read API behavior for cards and pricing
- Assemble server-side data in a way that stays consistent across feature surfaces
- Resolve cards and variants correctly before frontend rendering
- Protect public backend surfaces with the right access and rate-limit behavior

## Product Surfaces

- Catalog data is loaded from `@/lib/catalog/catalog.ts`
- Catalog may fall back to sibling-variant history when a specific variant has no direct history
- Temporary mock JPY pricing may exist only as an explicit fallback while live catalog pricing is incomplete
- Card detail should be server-fetched once in the route and passed into the client component as props
- Card detail should prefer the `STD` variant when multiple variants exist
- Price history APIs should resolve `cardCode` to an active variant before loading `price_history`
- If a task also changes layouts, chart presentation, or component behavior, open `/components/CONTEXT.md` as well

## Rules

- Public read routes currently include `/api/cards/[cardCode]` and `/api/prices/[cardCode]`
- Card detail should prefer the `STD` variant when multiple variants exist
- Price history APIs should resolve `cardCode` to an active variant before loading `price_history`
- Server routes and loaders should use shared pricing helpers from `@/lib/pricing`
- Public API endpoints should be rate limited
- Writes must stay in protected server-side code or GitHub Actions, never public clients
- Secrets such as `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the client
- Backend proposal or contract docs should follow `docs/CONTEXT.md`

## Testing Expectations

- Changes to backend logic, route behavior, variant resolution, or pricing queries should include or update relevant tests before merge
- Backend test files should use lowercase kebab-case and end with `.test.ts`
- Prefer placing backend tests in `tests/` or the nearest existing backend-focused test location that keeps the scope obvious
- If a backend change relies on manual validation instead of automated coverage, record the manual steps and call out the risk in the PR

## Documentation Expectations

- If backend behavior or API contracts change, update the matching docs under `docs/`
- If the task introduces or updates a proposal, follow `docs/CONTEXT.md`
