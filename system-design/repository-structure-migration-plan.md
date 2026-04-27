# Repository Structure Migration Plan

## Goal

Make frontend, backend, database, and data-pipeline code easier to distinguish in an existing project without doing a risky all-at-once rename.

The target is not to move everything out of `lib/` immediately. The target is to migrate the codebase in phases until the runtime boundaries are obvious:

- `components/` for shared frontend UI rules and component code
- `app/` for routes and route entrypoints
- `backend/` for server-only application logic
- `supabase/` for database schema and database workspace guidance
- `price-ingestion/` for collection and ingestion pipeline code
- `shared/` only for code that is genuinely used on both frontend and backend

## Current Reality

The current `lib/` tree is not one thing. It mixes:

- server-only feature logic
- shared formatting helpers
- shared types
- Supabase clients
- security helpers
- data-pipeline code
- generic UI utilities

That means renaming `lib/` directly to `backend/` would be inaccurate and would break the frontend/backend distinction we are trying to improve.

## Recommended Target Structure

```txt
app/
components/
backend/
supabase/
price-ingestion/
shared/
system-design/
operations/
```

Notes:

- `shared/` should be created only for code that is actually imported by both frontend and backend.
- `supabase/` should remain the database workspace and may also absorb DB-specific support code over time.
- `price-ingestion/` should become the real home of collection and ingestion logic, not just the planning workspace.

## Classification Of Current `lib/` Code

### Move To `backend/`

These are server-side application modules and should not stay in a generic bucket long term:

- `lib/card-detail/`
- `lib/catalog/`
- `lib/security/`
- `lib/config/env.ts`
- `lib/pricing/queries.ts`

### Move To `shared/`

These are used directly by frontend components and should not be buried under a backend-looking directory:

- `lib/pricing/index.ts`
- `lib/types/`
- `lib/utils.ts`

### Move Into `supabase/` Support Areas

These are database-access helpers, even if they are currently outside the schema directory:

- `lib/supabase/admin-client.ts`
- `lib/supabase/public-client.ts`
- `lib/supabase/server-client.ts`

Recommended target:

- `supabase/clients/admin-client.ts`
- `supabase/clients/public-client.ts`
- `supabase/clients/server-client.ts`

### Move Into `price-ingestion/`

These belong to the data pipeline rather than general backend code:

- `lib/pricing/ingestion/`
- `lib/scraper/`

Recommended target:

- `price-ingestion/lib/ingestion/`
- `price-ingestion/lib/scraper/`

### Hold For Later Review

These need a second pass because they mix shared and backend concerns:

- `lib/pricing/mock-data.ts`

Recommended likely split:

- if used only as frontend fallback display data, move to `shared/pricing/mock-data.ts`
- if used only by backend query assembly, move to `backend/pricing/mock-data.ts`

## Import Graph Findings

The current codebase already shows the runtime boundary clearly:

- frontend components import `@/lib/pricing`, `@/lib/types`, and `@/lib/utils`
- app routes and server pages import `@/lib/card-detail`, `@/lib/catalog`, `@/lib/security`, and `@/lib/pricing/queries`
- scripts import `@/lib/pricing/ingestion` and scraper-related code

This means:

- `pricing/index.ts`, `types`, and `utils` are the strongest `shared/` candidates
- `card-detail`, `catalog`, `security`, and `pricing/queries` are the strongest `backend/` candidates
- `pricing/ingestion` and `scraper` should become real `price-ingestion/` implementation code

## Migration Phases

## Phase 1: Create The New Top-Level Code Buckets

Create these directories without moving any code yet:

- `backend/`
- `shared/`
- `supabase/clients/`
- `price-ingestion/lib/`

Purpose:

- establish the target structure
- avoid a giant rename in one pass
- let docs and code converge gradually

## Phase 2: Move The Lowest-Risk Shared Code First

Move the code with the clearest cross-runtime identity:

- `lib/utils.ts` -> `shared/utils.ts`
- `lib/types/*` -> `shared/types/*`
- `lib/pricing/index.ts` -> `shared/pricing/index.ts`

Then update imports in:

- `components/*`
- `app/*`
- any server modules importing these helpers

Why first:

- these modules are small
- their purpose is already clear
- moving them immediately improves frontend/backend clarity

## Phase 3: Move Server-Only Feature Logic

Move the clearly server-side application modules:

- `lib/card-detail/` -> `backend/card-detail/`
- `lib/catalog/` -> `backend/catalog/`
- `lib/security/` -> `backend/security/`
- `lib/config/env.ts` -> `backend/config/env.ts`
- `lib/pricing/queries.ts` -> `backend/pricing/queries.ts`

Then update:

- `app/api/*`
- `app/page.tsx`
- `app/cards/[cardCode]/page.tsx`
- any backend-only internal imports

Important note:

`card-detail` exports types that are consumed by frontend components today. If those response types still need to be imported by client components after the move, split them out into:

- `shared/types/card-detail.ts`

Do not force frontend code to import types from `backend/` if you want the runtime boundary to stay obvious.

## Phase 4: Move Supabase Helper Clients

Move DB helper clients from `lib/supabase/` into the database area:

- `lib/supabase/admin-client.ts` -> `supabase/clients/admin-client.ts`
- `lib/supabase/public-client.ts` -> `supabase/clients/public-client.ts`
- `lib/supabase/server-client.ts` -> `supabase/clients/server-client.ts`

Then update imports in:

- `backend/*`
- `price-ingestion/*`
- any route handlers or server loaders using those clients

Purpose:

- keep database access concerns close to the database workspace
- make the DB boundary easier to find for future contributors

## Phase 5: Move Real Pipeline Code Into `price-ingestion/`

Move pipeline implementation out of `lib/`:

- `lib/pricing/ingestion/` -> `price-ingestion/lib/ingestion/`
- `lib/scraper/` -> `price-ingestion/lib/scraper/`

Update imports in:

- `scripts/price-ingestion/*`
- `scripts/scrape/*`
- any supporting modules

Purpose:

- make the data-pipeline workspace a real implementation home
- stop splitting collection and ingestion logic across top-level buckets

## Phase 6: Review Remaining `lib/` Files

At this point, audit what remains in `lib/`.

Likely outcomes:

- delete `lib/` entirely if empty
- or keep a very small compatibility layer temporarily while imports are being cleaned up

No broad rename should happen until the remaining contents are understood file by file.

## Order Of Execution

Recommended implementation order:

1. Create target directories
2. Move `shared` modules
3. Move backend modules
4. Move Supabase clients
5. Move ingestion and scraper modules
6. Clean up any remaining `lib/` residue

This order minimizes broken imports and keeps each change reviewable.

## Risks And Watchouts

### Shared Types Hidden Inside Backend Modules

`lib/card-detail/types.ts` currently feeds frontend consumers through exported response types. If moved blindly into `backend/`, frontend code may end up importing backend modules just for types.

Mitigation:

- extract API response types into `shared/types/` before or during the move

### Mixed Pricing Concerns

`lib/pricing/` currently contains both shared formatting helpers and backend query logic.

Mitigation:

- split it deliberately:
  - `shared/pricing/index.ts`
  - `backend/pricing/queries.ts`
  - move `mock-data.ts` only after confirming whether it is frontend fallback data or backend assembly data

### Import Churn

This repo uses the `@/*` path alias, so every move will require import rewrites.

Mitigation:

- move one slice at a time
- run type checks after each phase
- do not stack multiple major path moves into one commit

### Workspace Docs Going Stale

The workspace docs now describe a cleaner structure than the code fully reflects.

Mitigation:

- update `AGENT.md` and affected `CONTEXT.md` files during each migration phase, not at the end

## Suggested First Implementation PR

The safest first PR is:

1. create `shared/`
2. move `lib/utils.ts`
3. move `lib/types/`
4. move `lib/pricing/index.ts`
5. update imports
6. update docs to reflect the new shared boundary

Why:

- it improves frontend/backend clarity immediately
- it has low architectural risk
- it avoids touching the more coupled server modules first

## Success Criteria

The migration is successful when:

- frontend code no longer imports general-purpose modules from a backend-looking bucket
- server-only logic is easy to find under `backend/`
- database-specific code is easy to find under `supabase/`
- ingestion and scraper logic live together under `price-ingestion/`
- `lib/` is either gone or reduced to a short-lived compatibility shim
