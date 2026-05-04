# Operations Workspace Context

Last updated: 2026-04-30

## Identity

This workspace covers the operational layer that keeps the product healthy: automation, deployment readiness, audits, Git/GitHub workflow rules, and supporting maintenance workflows.

## Primary Source Areas

- `.github/workflows/`
- `scripts/dev/`
- `scripts/price-ingestion/validate-deployment-readiness.ts`
- `docs/`

## Reference Docs

- `docs/CONTEXT.md` is the docs entrypoint for folder meanings, naming, proposal lifecycle, and where stable reference docs now live
- After opening `docs/CONTEXT.md`, use the relevant files under `docs/reference/` for operational history, release context, or incident detail only when needed

## Responsibilities

- Run scheduled and manual operational workflows safely
- Validate deployment readiness before shipping changes
- Support audits for ingestion quality and variant identity
- Define branch, commit, and pull request workflow expectations
- Document rollout decisions, incidents, and follow-up actions

## Operational Guardrails

- Scheduled scraping should run through GitHub Actions, not public runtime triggers
- Manual runs should use `workflow_dispatch` with validated inputs and repo-owner control
- Deployment-readiness checks should run before shipping pricing pipeline changes
- Operational docs should capture incidents, rollout choices, and follow-up work clearly

## Git Workflow Rules

- Branch names should be short, descriptive, and category-based: `feature/...`, `update/...`, or `fix/...`
- Branch names should describe the work being done, not a vague ticket placeholder
- Branch suffixes should use lowercase kebab-case
- Commits should be focused, intentional, and small enough to review clearly
- Commit messages should be concise and action-oriented
- Pull requests should summarize scope, user or system impact, and any validation that was run
- Use draft pull requests when the change is still in progress or needs follow-up work before review
- After opening a pull request, run a review pass for scope, validation, docs, and risk
- If no issues are found, present the PR as ready for final approval
- Do not merge until Dave approval and required checks pass
- Do not mix unrelated refactors or cleanup into a focused feature or bugfix branch unless it is necessary for the change
- If a change affects deployment, ingestion quality, or public pricing behavior, call that out explicitly in the PR

## Rules

- Prefer repeatable scripts over ad hoc manual steps
- Operational checks should protect production data quality and runtime stability
- Documentation should reflect real current workflows, not aspirational ones
- Cost discipline should stay aligned with the project's zero-monthly-cost target

## Documentation Expectations

- Use `docs/` as the source of truth for proposal status, readiness notes, and incident history
- When proposal status changes, move the proposal between `docs/proposals/`, `docs/approved/`, and `docs/implemented-proposals/` as defined in `docs/CONTEXT.md`
