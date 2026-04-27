# Reference

## 1. ID Normalization Table

Use the following as the golden standard for all stored card IDs.

- Bad: `OP1-1`
- Bad: `OP01-1`
- Bad: `OP-01-001`
- Golden: `OP01-001`

Normalization rule:

- Always use 2 digits for the set number
- Always use 3 digits for the card number
- Store IDs in uppercase
- Use a single hyphen between prefix/set and card number
- Supported prefixes: `OP`, `ST`, `P`, `EB`, `PRB`

Examples:

- `OP1-1` -> `OP01-001`
- `OP01-1` -> `OP01-001`
- `OP-01-001` -> `OP01-001`
- `PRB1-1` -> `PRB01-001`

## 2. Variant Suffix Mapping

Use these suffixes consistently when generating synthesized variant IDs.

- `_STD`: Standard Art
- `_AA`: Alternate Art / Parallel
- `_M`: Manga Rare
- `_SP`: Special Card (Reprint art)
- `_TR`: Treasure Rare

Examples:

- `OP01-001_STD`
- `OP01-001_AA`
- `OP01-001_M`

## 3. Punk-Records Integration Notes

Raw JSON sources:

- Japanese Index: `https://raw.githubusercontent.com/buhbbl/punk-records/main/japanese/index/cards_by_id.json`
- Set List: `https://raw.githubusercontent.com/buhbbl/punk-records/main/japanese/packs.json`
- Pack Card Files: `https://raw.githubusercontent.com/buhbbl/punk-records/main/japanese/cards/[PACK_ID].json`

Notes:

- Treat Punk-Records as a source for seeding and metadata enrichment
- Normalize all inbound IDs before inserting into your database
- Validate set and card codes against the project’s golden ID format before creating variants
- Use `cards_by_id.json` for discovery and per-pack card files for full card details like `cost`, `power`, `types`, and `effect`

## 4. Scraper Target Selectors

Current pricing scope note:

- Card Rush is the only active pricing source under the current project scope.
- Card Rush remains manual-fixture only until an approved data-use path or authorized feed exists.
- Yuyu-Tei is deferred for current pricing work.

Known target URLs and patterns:

- Card Rush JP: `https://www.cardrush-pokemon.jp/product-list?keyword=[ID]`
- Yuyu-Tei: Search URL structure for One Piece must be confirmed and documented before any future pricing-scope expansion

Scraper notes:

- Always search using the normalized golden ID
- Record selectors, out-of-stock indicators, and price element paths here as they are verified
- Keep this file updated whenever a shop changes its page structure
