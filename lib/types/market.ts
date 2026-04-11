export const MARKET_SOURCE_IDS = ["card_rush", "yuyu_tei", "mercari_jp"] as const;

export type MarketSourceId = (typeof MARKET_SOURCE_IDS)[number];

export const SCRAPER_PROVIDER_CODES = [
  "card-rush",
  "yuyu-tei",
  "mercari-jp"
] as const;

export type ScraperProviderCode = (typeof SCRAPER_PROVIDER_CODES)[number];

export const SOURCE_TYPES = ["retail", "p2p", "buyback"] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export const AVAILABILITY_STATUSES = ["available", "sold_out", "error"] as const;

export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

export const SCRAPER_PROVIDER_TO_MARKET_SOURCE_ID: Record<
  ScraperProviderCode,
  MarketSourceId
> = {
  "card-rush": "card_rush",
  "yuyu-tei": "yuyu_tei",
  "mercari-jp": "mercari_jp"
};
