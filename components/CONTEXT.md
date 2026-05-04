# Components Workspace Context

Last updated: 2026-04-30

## Identity

This workspace covers shared frontend implementation patterns used across the app. Use it when building components, layouts, charts, loading states, client-side interactions, or visual rules that should stay consistent across catalog and card detail surfaces.

## Workspace Use

- `components/` is both a real implementation directory and the shared frontend workspace entrypoint
- Use this file to route frontend work before opening feature-specific component files
- Load only the smallest relevant slice under `components/`, `app/`, or `app/globals.css` for the task at hand

## Primary Source Areas

- `app/`
- `components/`
- `components/ui/`
- `components/providers/`
- `app/globals.css`
- `docs/`

## Reference Docs

- `docs/CONTEXT.md` is the docs entrypoint for folder meanings, naming, proposal lifecycle, and where stable reference docs now live
- Load docs only when the task changes documented behavior, proposal status, or user-facing implementation guidance

## Responsibilities

- Define shared UI implementation standards across feature workspaces
- Own layout, styling, charting, loading, and client-side display behavior
- Keep shared presentation logic aligned with pricing helpers and domain rules
- Support catalog and card-detail experiences without duplicating frontend conventions

## Product Surfaces

- Catalog UI should show card image, code, rarity, variant label, and display price
- Catalog sorting should remain stable even when some cards have incomplete live pricing
- Card detail UI should show JPY price, 24h movement, chart ranges, and marketplace pricing states clearly
- Price charts should support `1D`, `1W`, `1M`, `3M`, and `ALL`
- Marketplace tables should show a `Sold Out` badge when a source returns a `null` value
- If a task also changes data loading, variant resolution, or API behavior, open `/backend/CONTEXT.md` as well

## Rules

- Framework: Next.js App Router
- UI kit: `shadcn/ui` primitives for layout, form, overlay, and structural UI elements
- Charts: `Recharts` with `AreaChart`
- Icons: `Lucide React`
- Theme: dark mode using a Slate/Zinc palette
- Cards: use `AspectRatio` (`2/3`) for TCG card displays
- Catalog grids: use a 2-column mobile / 5-column desktop layout
- Loading: use shadcn `Skeleton` components for initial fetch states
- Format frontend pricing with the shared helpers in `@/lib/pricing`
- JPY is the default display currency; USD and EUR are reference conversions only
- Frontend proposal or behavior docs should follow `docs/CONTEXT.md`

## Testing Expectations

- Changes to shared components, charts, or UI logic should include or update relevant tests before merge
- Component test files should use lowercase kebab-case and end with `.test.tsx`
- Shared frontend logic tests should use lowercase kebab-case and end with `.test.ts`
- If the repo does not yet have a colocated frontend test file for the area, add the test in the nearest sensible test location and call out the placement in the PR
- If tests cannot be added yet, explain why and document the remaining risk before asking for merge approval

## Documentation Expectations

- If a frontend task changes shared behavior, update the relevant file under `docs/`
- If the task starts or revises a proposal, follow `docs/CONTEXT.md`
