# Database Setup Checklist

- [x] Added direct Postgres test configuration support to `.env.example`
- [x] Added local test credentials file at `.env.test.local`
- [x] Added isolated card interface definition at `tests/db/types/card.ts`
- [x] Added isolated database smoke test SQL at `tests/db/card-smoke.sql`
- [x] Added isolated database smoke test runner at `tests/db/run-card-smoke.sh`
- [x] Added package script for the smoke test: `pnpm test:db:cards`
- [x] Successfully connected to Supabase Postgres
- [ ] Successfully queried `public.cards`
- [ ] Verified returned schema against the shared `Card` interface
- [x] Added DB smoke coverage for raw price observation storage
- [x] Added DB smoke coverage for canonical price insertion
- [x] Included a sold-out raw observation case with `price_jpy = null`
- [x] Kept the smoke test transaction-scoped with rollback

## Current Blocker

Connection to the new Supabase database is working.

Verified with:

`current_database = postgres`

`current_user = postgres`

The remaining unchecked items are intentionally deferred because we are only validating connectivity right now.
