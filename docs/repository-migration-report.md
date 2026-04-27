# Repository Migration Report

Audit date: 2026-04-11

## Summary

This project is ready to move into a git repository after excluding local runtime artifacts, generated build output, dependency folders, and real environment files.

The workspace is not currently a git repository. That means the updated `.gitignore` will apply cleanly before the first commit.

## Do Not Move To The Repo

These files and directories should stay local and are now covered by `.gitignore`:

| Path | Why it should not be committed |
| --- | --- |
| `.env` | Local runtime secrets and machine-specific configuration. |
| `.env.*` | Environment-specific secrets such as production, test, and local credentials. |
| `.env.local` | Contains local Supabase service-role configuration and must remain private. |
| `.env.test.local` | Contains local database test credentials and must remain private. |
| `node_modules/` | Installed dependencies. This is reproducible from `package.json` and `pnpm-lock.yaml`; current local size is about 548 MB. |
| `.next/` | Generated Next.js build/dev output and cache; current local size is about 355 MB. |
| `.pnpm-store/` | Local pnpm package store/cache; it is machine-specific and reproducible. |
| `*.tsbuildinfo` | TypeScript incremental compiler cache; `tsconfig.tsbuildinfo` is generated locally. |
| `coverage/` | Generated test coverage output. |
| `playwright-report/` | Generated Playwright report output. |
| `test-results/` | Generated Playwright/test run artifacts. |
| `build/`, `dist/`, `out/` | Generated production build/export output. |
| `.vercel/` | Local Vercel project linkage and deployment state. |
| `.turbo/`, `.cache/` | Tooling caches that are local and reproducible. |
| `*.log`, debug logs | Runtime/debug output, usually noisy and machine-specific. |
| `.DS_Store`, `Thumbs.db`, `.idea/`, `.vscode/` | OS/editor workspace noise that should not define the project. |

Important note: `.env.example` is intentionally not ignored. It should be committed because it documents the required environment variables without storing real values.

## Move To The Repo

These project files should be included because they define the application, infrastructure, documentation, tests, and reproducible install:

| Path | Why it should be committed |
| --- | --- |
| `app/` | Next.js App Router pages, layouts, API routes, and global styles. |
| `components/` | Shared UI, catalog, dashboard, and provider components. |
| `lib/` | Domain logic, Supabase clients, pricing helpers, scraper utilities, and shared types. |
| `scripts/` | Seed, scrape, and package-manager enforcement scripts used by local and CI workflows. |
| `supabase/migrations/` | Database schema, RLS policies, and migration history needed to reproduce the backend. |
| `tests/` | Database smoke tests and checklist docs. |
| `.github/workflows/` | GitHub Actions scraper workflow. It references secrets by name and does not store secret values. |
| `docs/` | Product and implementation documentation. |
| `README.md` | Project onboarding and security notes. |
| `package.json` | Project scripts, dependency metadata, engine requirements, and package manager declaration. |
| `pnpm-lock.yaml` | Required for reproducible pnpm installs and CI cache correctness. It was previously ignored and should be tracked. |
| `.npmrc` | Enforces engine strictness and frozen lockfile preferences for consistent installs. |
| `.env.example` | Safe environment template that documents required variables. |
| `next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `next-env.d.ts`, `middleware.ts` | Project configuration and framework/type integration files. |
| `AGENT.md`, `reference.md` | Project/product reference notes. Keep them if this repo is private or if the notes are intended to be shared with contributors. |

## Review Before Public Release

These files are not automatically unsafe, but they deserve a quick human check before publishing to a public repo:

| Path | Review reason |
| --- | --- |
| `AGENT.md` | Contains product direction, architecture notes, and security strategy. Good for a private/team repo; potentially too detailed for a public repo. |
| `reference.md` | Contains source URLs, scraper notes, and ID normalization rules. Likely useful, but confirm the scraper target notes are okay to publish. |
| `docs/live-marketplace-incident-report.md` | Contains detailed implementation analysis and absolute local path references from the current machine. Useful internally, but consider converting links to relative paths before public release. |
| `.github/workflows/scraper.yml` | It correctly uses GitHub secrets, but the remote repo must define those secrets before the scheduled workflow can run. |

## Remote Secret Setup Required

Do not move local `.env*` values into git. Configure these as GitHub repository secrets and deployment environment variables instead:

| Variable | Where it is needed |
| --- | --- |
| `SUPABASE_URL` | GitHub Actions scraper and server-side Supabase access. |
| `SUPABASE_SERVICE_ROLE_KEY` | GitHub Actions scraper and secure server-side writes only. |
| `DATABASE_URL` | Local or CI database smoke tests if used. |
| `DB_PW` | Local or CI database smoke tests if used. |
| `UPSTASH_REDIS_REST_URL` | Rate limiting runtime if enabled. |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting runtime if enabled. |
| `SCRAPER_MANUAL_RUN_TOKEN` | GitHub Actions manual scraper trigger validation. |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public client/runtime configuration. These are public by design, but should still be environment-specific. |
| `VERCEL_PROJECT_PRODUCTION_URL` | Deployment/runtime URL configuration if used. |

## Changes Made In This Audit

- Expanded `.gitignore` to cover dependencies, generated Next.js output, build artifacts, TypeScript caches, local environment files, test reports, framework caches, logs, and OS/editor noise.
- Kept `.env.example` explicitly trackable so future contributors can configure the project safely.
- Removed the previous `pnpm-lock.yaml` ignore rule because this pnpm project should commit its lockfile for reproducible installs.

## Verification Notes

- Verified ignore behavior with a temporary git metadata directory outside the project because this workspace has not been initialized as a git repository yet.
- Confirmed `.env.local`, `.env.test.local`, `.next/`, `node_modules/`, `.pnpm-store/`, and `tsconfig.tsbuildinfo` are ignored.
- Confirmed `pnpm-lock.yaml` appears in the trackable file list for the first commit.

## Recommended Migration Steps

1. Initialize the repository only after confirming the review-before-public-release notes above.
2. Run a final ignore check and confirm local-only files are excluded.
3. Add the project files, including `pnpm-lock.yaml`.
4. Configure GitHub repository secrets before enabling or relying on the scraper workflow.
5. Run `pnpm install --frozen-lockfile`, `pnpm typecheck`, and any relevant smoke tests after cloning from the new repo to verify the migration.
