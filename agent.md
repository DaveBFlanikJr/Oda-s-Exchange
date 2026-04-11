# OPTCG-Japan-Tracker (JPY)

## 1. Role & Context

You are a Technical Product Engineer specialized in the Japanese Trading Card Game (TCG) market. Your goal is to build and maintain a high-precision price intelligence service for One Piece Card Game (OPTCG) cards, specifically targeting the Tokyo secondary market in Japanese Yen (JPY).

### Core Constraints

- Primary currency: JPY
- Data sources: Prioritize Japanese platforms including Card Rush, Yuyu-Tei, and Mercari JP
- Package manager: Strictly `pnpm`; do not use `npm` or `yarn`
- HTTP client: Strictly `axios@1.14.0`
- Cost efficiency: Target $0/month infrastructure using Vercel, Supabase, and GitHub Actions
- Security: Enforce zero-public-write access to prevent unauthorized database manipulation

## 2. Current Architecture & Security Layer

### A. Data Ingestion (Collector)

- Tooling: Playwright with Node.js via `pnpm`
- Execution target: GitHub Actions on a JST cron schedule
- Schedule target: `0 0 * * *` JST
- Parsing rule: strict JPY-only extraction
- Outlier rule: flag prices that materially undercut expected market value before persistence

#### Security: Trigger Protection

- Scraping must remain strictly internal to GitHub Actions
- No public API endpoint may exist to trigger a fetch
- Manual runs must use `workflow_dispatch` with validated inputs and be limited to the repo owner
- Set `concurrency: scraper-singleton` to prevent overlapping scraper runs

### B. Storage (Supabase / PostgreSQL)

- Provider: Supabase (PostgreSQL)
- Canonical pricing grain: `card_variants`
- Public read model: cards, variants, and price history are readable
- Write model: service role only

#### Security: Database Shield

- Enable Row Level Security (RLS)
- `anon` role: `SELECT` only, for frontend reads
- `service_role`: full access, used only by GitHub Actions or protected server-side code
- Restrict CORS to the production Vercel URL and localhost

### C. Frontend

- Framework: Next.js App Router
- UI components: shadcn/ui primitives
- Charting: `Recharts` with `AreaChart`
- Current route structure:
  - Catalog: `/`
  - Card detail: `/cards/[cardCode]`
  - Card detail API: `/api/cards/[cardCode]`
  - Price history API: `/api/prices/[cardCode]`

## 3. Domain Model

### Canonical Entities

- `cards`: base card metadata
- `card_variants`: variant-specific identity, rarity, image, and set data
- `price_history`: time-series price points per `variant_id`

### Current Pricing Module

- Central pricing helpers live in `@/lib/pricing/index.ts`
- Shared helpers include:
  - `formatJPY`
  - `formatCurrency`
  - `formatPercent`
  - `convertFromJpy`
  - `calculateMedian`
  - `calculateSpread`

### Current Catalog State

- Catalog data is loaded from `@/lib/catalog/catalog.ts`
- Catalog attempts to read real price history from Supabase
- If a specific variant has no direct history, catalog can fall back to sibling-variant history
- The product card UI currently uses deterministic fake price fallback data when real catalog price data is unavailable
- This fake fallback is temporary and should be removed once the real price intelligence pipeline is fully populated

## 4. UI & Design Standards

### Frameworks & Libraries

- UI kit: `shadcn/ui` (Radix + Tailwind)
  - Instruction: Use shadcn primitives for layout, form, overlay, and structural UI elements
- Charts: `Recharts`
  - Instruction: Use `AreaChart` for price history and format all currency as JPY (`¥`)
- Icons: `Lucide React`

### Styling Patterns

- Theme: Dark mode using a Slate/Zinc palette
- Cards: Use `AspectRatio` (`2/3`) for all TCG card displays to maintain physical card proportions
- Grids: Use a 2-column mobile / 5-column desktop layout for the Product Catalog

### Data Handling

- JPY display: Use the centralized `formatJPY` helper from `@/lib/pricing`
- FX reference display: Use `formatCurrency` and `convertFromJpy` from `@/lib/pricing`
- Loading: Use shadcn `Skeleton` components for initial data fetch states

## 5. UI/UX Requirements

### Catalog

- Show card image, card code, rarity, variant label, and display price
- Until live catalog pricing is complete, product cards may use deterministic mock JPY price fallback
- Sort behavior should remain stable even when some cards do not yet have real price data

### Card Detail

- Server-fetch card detail once in the route
- Pass server-fetched payload into the client component as props
- Do not double-fetch the same card detail on the client

### Layout Design

- Hero/detail views: Show JPY price with 24h change percentage using green/red state
- Interactive chart:
  - Toggles: `1D`, `1W`, `1M`, `3M`, `ALL`
  - Style: Area series with gradient fill
- Marketplace table:
  - Direct buy links to Card Rush, Yuyu-Tei, and Mercari JP
  - Show a `Sold Out` badge when a source returns a `null` value
- Currency toggle:
  - Client-side conversion to USD and EUR for reference only
  - JPY remains the source of truth

## 6. Technical Implementation Logic

### Scraper Logic (Playwright)

```ts
const rawPrice = await page.innerText(".price_tag");
const cleanJPY = parseInt(rawPrice.replace(/[^0-9]/g, ""), 10);

// If a scraped price is suspiciously below expected market value,
// flag it for review rather than trusting it blindly.
```

### Current Database Shape

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

### Querying Rules

- Card detail should prefer the `STD` variant when multiple variants exist
- Price history APIs should resolve `cardCode` to an active variant before loading `price_history`
- JPY is the canonical stored currency
- USD and EUR are derived client-side for reference only

## 7. Security Checklist (Must Follow)

- [ ] `SUPABASE_SERVICE_ROLE_KEY` must never be exposed via `NEXT_PUBLIC_*`
- [ ] All writes must happen in GitHub Actions or protected server-side code
- [ ] Public consumers must never have write access to `price_history`
- [ ] Rate limiting should protect public API endpoints
- [ ] Scraping must not be triggerable from a public route

## 8. Near-Term Priorities

- Replace temporary catalog mock pricing with real populated price intelligence data
- Build a dedicated price intelligence service that returns:
  - current price
  - previous price
  - 24h change
  - source snapshots
  - chart points
- Keep catalog and detail pages aligned to the same pricing source of truth
- Continue keeping pricing and formatting logic centralized under `@/lib/pricing`

## 9. Success Metrics

- Verification: Stored JPY price points match Tokyo market listings within an acceptable margin
- Cost: Stay within $0/month free-tier limits for Vercel and Supabase
- Robustness: Scraper handles out-of-stock states without breaking charts or detail views
- Consistency: Catalog and card detail pricing derive from the same domain logic

## End of `agent.md`
