# Supabase Workspace Context

Last updated: 2026-04-30

## Identity

This workspace covers the data model, persistence rules, and security boundaries for storing cards, variants, and price history in Supabase/PostgreSQL.

## Workspace Use

- `supabase/` is both the implementation directory and the workspace entrypoint for database work
- Use this file when the task touches schema design, migrations, persistence behavior, or Supabase-specific access rules
- Load supporting files from `lib/supabase/` and `tests/db/` only when the task requires them

## Primary Source Areas

- `supabase/migrations/`
- `lib/supabase/`
- `tests/db/`

## Reference Docs

- `docs/CONTEXT.md` is the docs entrypoint for folder meanings, naming, proposal lifecycle, and where stable reference docs now live
- After opening `docs/CONTEXT.md`, use the relevant files under `docs/reference/` for migration history, release validation, or data-quality background only when needed

## Responsibilities

- Evolve the schema safely through migrations
- Preserve canonical relationships between cards, variants, and price records
- Support public read access while preventing public writes
- Back database changes with smoke checks or validation where practical

## Storage Model

- Provider: Supabase (PostgreSQL)
- Canonical pricing grain: `card_variants`
- Public read model: cards, variants, and price history are readable
- Write model: service role only

## Canonical Entities

- `cards`: base card metadata
- `card_variants`: variant-specific identity, rarity, image, and set data
- `price_history`: time-series price points per `variant_id`

## Current Database Shape

```sql
create table public.cards (
  id text primary key,
  card_set_id text not null,
  name_en text not null,
  name_jp text,
  card_type public.op_card_type not null,
  rarity_base text,
  color text,
  cost integer,
  power integer,
  counter integer,
  text_en text,
  text_jp text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.card_variants (
  id text primary key,
  card_id text not null references public.cards(id) on delete cascade,
  variant_type public.op_variant_suffix not null default 'STD',
  variant_rarity text not null,
  set_id text not null,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  variant_id text not null references public.card_variants(id) on delete cascade,
  source public.op_market_source not null,
  price_jpy integer,
  availability_status public.op_availability not null default 'available',
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

## Rules

- Row Level Security should remain enabled
- Public consumers should have read-only access patterns
- Writes should be limited to service-role or protected server-side execution
- Secrets such as `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the client

## Testing Expectations

- Schema or persistence changes should include or update relevant database validation before merge
- Database smoke checks and SQL validation should live under `tests/db/`
- Database-oriented TypeScript tests should use lowercase kebab-case and end with `.test.ts`
- Migration-related validation should be called out explicitly in the PR, including any checks that were not run

## Documentation Expectations

- Update `docs/` when schema or persistence behavior changes affect rollout or operator expectations
- If the task starts or revises a proposal, follow `docs/CONTEXT.md`
