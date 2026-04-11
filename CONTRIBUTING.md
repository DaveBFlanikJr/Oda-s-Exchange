# Contributing

## Branch Rules

When starting work from a request, create a focused branch from the latest `master`.

- Feature work: `feature/<kebab-case-feature-name>`
- Fix work: `fix/<kebab-case-fix-name>`

Examples:

- `feature/card-search-filters`
- `feature/supabase-public-read-client`
- `fix/rate-limit-production-config`
- `fix/card-detail-empty-state`

Use lowercase kebab-case after the slash. Keep branch names short, descriptive, and scoped to one change.

## Before Implementing Changes

- Confirm the current branch and make sure the worktree is clean.
- Pull or fetch the latest `master` before creating the work branch.
- Check whether the change is a feature, fix, refactor, docs-only update, or maintenance task.
- Avoid committing `.env*` files, generated build output, dependency folders, caches, logs, or local editor files.
- Keep secrets in deployment providers or GitHub repository secrets, never in code or docs.
- Prefer small, focused commits that match the branch purpose.
- Run `pnpm typecheck` before committing TypeScript changes.
- Run `pnpm build` before pushing changes that affect routing, server components, Next config, or deployment behavior.
- For Supabase changes, include or update migrations and confirm RLS/service-role boundaries.
- For GitHub Actions changes, verify required repository secrets are documented before relying on the workflow.

## Pull Request Checklist

- The branch name follows the rule above.
- The change has a clear summary and test notes.
- No local secrets or generated artifacts are staged.
- Typecheck passes, or any verification gap is called out.
- Security-sensitive changes mention the affected env vars, permissions, or access boundaries.
