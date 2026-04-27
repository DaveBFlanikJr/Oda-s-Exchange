# OPTCG Japan Tracker

Project skeleton for a Tokyo secondary-market One Piece Card Game tracker with:

- Next.js App Router frontend
- Supabase-backed JPY price history
- GitHub Actions deployment-readiness workflow
- Strict `pnpm` package management
- `axios >= 1.6.0` for HTTP requests

## Current Pricing Scope

- Card Rush is the only active pricing source under the current project scope.
- Card Rush remains manual-fixture only until an approved data-use path or authorized feed exists.
- Yuyu-Tei and Mercari JP are deferred for current pricing work.

## Getting Started

1. Use `pnpm` only.
2. Copy `.env.example` to `.env.local`.
3. Install dependencies with `pnpm install`.
4. Run the app with `pnpm dev`.

## Security Notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client
- Keep public database access read-only
- Run writes only in secure server contexts
