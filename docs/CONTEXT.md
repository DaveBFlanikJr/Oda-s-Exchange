# Docs Context

Last updated: 2026-04-30

## Identity

This file defines how documentation under `docs/` should be named, organized, and moved as work progresses. `docs/` is not a formal workspace, but it is the shared home for planning, rollout notes, approved proposals, and implemented proposal history.

## Folder Use

- `docs/`: top-level docs process and status entrypoints such as `CONTEXT.md`
- `docs/reference/`: stable non-proposal documentation such as runbooks, rollout notes, checklists, reports, incident writeups, and reference docs
- `docs/proposals/`: active proposal drafts that are still being reviewed or awaiting approval
- `docs/approved/`: proposals that have been accepted but are not fully implemented yet
- `docs/implemented-proposals/`: proposals that have been implemented and should be kept as historical references

Keep stable non-proposal docs in `docs/reference/`. Keep only top-level docs process files such as `docs/CONTEXT.md` in the `docs/` root. Move proposal files through the proposal lifecycle folders as their status changes. Keep the same filename when moving a proposal unless there is a strong reason to rename it.

## What These Are

- `docs/CONTEXT.md`: the documentation process guide for naming, lifecycle, and folder use
- `docs/reference/`: stable reference material you read for context, implementation rules, rollout history, and operational guidance
- `docs/proposals/`: active proposals that are still being reviewed or awaiting approval
- `docs/approved/`: approved proposals waiting on full implementation
- `docs/implemented-proposals/`: historical proposals that have already been implemented

## Naming Conventions

- General documentation files under `docs/` should use lowercase kebab-case and end with `.md`
- Proposal files should use the format `[proposal-name]-[workspace].md`
- The `[proposal-name]` portion should be short, descriptive, and lowercase kebab-case
- The `[workspace]` portion should describe the primary workspace or system area affected, using the repo's existing workspace language such as `components`, `backend`, `price-ingestion`, `supabase`, `system-design`, or `operations`

Examples:

- `pricing-read-alignment-system-design.md`
- `card-detail-api-backend.md`
- `canonical-publish-flow-price-ingestion.md`

## Writing Tone

- Documents under `docs/` should use a technical writing tone
- Treat these files as engineering documents: specifications, proposals, runbooks, reports, and implementation references
- Write for engineers and technical collaborators, not for marketing or general-audience copy
- Prefer precise terminology, explicit assumptions, concrete behavior, and implementation-relevant detail
- Avoid casual phrasing, promotional language, or vague high-level filler
- If a writing-focused skill exists in the current session that helps produce clear technical documentation, use it

## Proposal Lifecycle

1. Create new proposal drafts in `docs/proposals/`
2. Move accepted proposals into `docs/approved/`
3. Move implemented proposals into `docs/implemented-proposals/`

Each move should reflect the real status of the work, not an aspirational next state.

## Time Log Requirement

Every proposal file should include a `## Time Log` section.

The time log should:

- record the timestamp of the latest modification to the proposal
- include meaningful edits, review updates, approval-state changes, folder-status changes, and implementation completion
- treat implementation completion as a modification and log it there
- use explicit timestamps with timezone, for example `2026-04-30 23:00:36 JST`

Recommended format:

```md
## Time Log

- 2026-04-30 23:00:36 JST - Created proposal in `docs/proposals/`
- 2026-05-01 10:15:00 JST - Revised proposal after senior review
- 2026-05-02 14:40:00 JST - Moved to `docs/approved/` after approval
- 2026-05-04 18:05:00 JST - Implemented and moved to `docs/implemented-proposals/`
```

The newest entry should always reflect the last modification made to the file.

## Responsibilities

- Keep proposal history understandable as work moves from draft to approved to implemented
- Preserve consistent naming so proposal files stay easy to search and sort
- Make documentation status obvious without needing to infer it from Git history alone
- Keep time logs current enough that the last modification is visible inside the document itself
