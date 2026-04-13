export const PRICE_INGESTION_PARSER_VERSION = "price-ingestion.v1" as const;
export type PriceIngestionParserVersion = typeof PRICE_INGESTION_PARSER_VERSION;

export const PRICE_INGESTION_SOURCE_POLICY_STATUSES = [
  "unknown",
  "pending",
  "approved",
  "restricted",
  "denied"
] as const;

export type PriceIngestionSourcePolicyStatus =
  (typeof PRICE_INGESTION_SOURCE_POLICY_STATUSES)[number];

export const PRICE_INGESTION_COLLECTION_METHODS = [
  "unknown",
  "manual_fixture",
  "authorized_feed",
  "api",
  "html_scrape"
] as const;

export type PriceIngestionCollectionMethod =
  (typeof PRICE_INGESTION_COLLECTION_METHODS)[number];

export const PRICE_INGESTION_LISTING_KINDS = [
  "unknown",
  "single_card",
  "graded_card",
  "sealed_product",
  "deck_product",
  "proxy_custom",
  "ambiguous"
] as const;

export type PriceIngestionListingKind =
  (typeof PRICE_INGESTION_LISTING_KINDS)[number];

export const PRICE_INGESTION_CONDITION_SCALES = [
  "mint",
  "near_mint",
  "light_play",
  "moderate_play",
  "damaged",
  "graded",
  "unknown"
] as const;

export type PriceIngestionConditionScale =
  (typeof PRICE_INGESTION_CONDITION_SCALES)[number];

export const PRICE_INGESTION_MATCH_CONFIDENCES = [
  "low",
  "medium",
  "high",
  "excluded"
] as const;

export type PriceIngestionMatchConfidence =
  (typeof PRICE_INGESTION_MATCH_CONFIDENCES)[number];

export const PRICE_INGESTION_CANONICAL_PRICING_BASES = [
  "daily_best_available_jst",
  "daily_best_available_ungraded_best_condition_jst"
] as const;

export type PriceIngestionCanonicalPricingBasis =
  (typeof PRICE_INGESTION_CANONICAL_PRICING_BASES)[number];

export const PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS =
  "daily_best_available_ungraded_best_condition_jst" as const;
