# Components Workspace Context

Last updated: 2026-04-27

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
