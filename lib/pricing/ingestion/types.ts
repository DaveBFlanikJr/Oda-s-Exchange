import type { AvailabilityStatus, MarketSourceId } from "@/lib/types/market";
import type {
  PriceIngestionCanonicalPricingBasis,
  PriceIngestionCollectionMethod,
  PriceIngestionConditionScale,
  PriceIngestionEvidenceKind,
  PriceIngestionListingKind,
  PriceIngestionMatchConfidence,
  PriceIngestionParserVersion,
  PriceIngestionSourcePolicyStatus
} from "@/lib/pricing/ingestion/constants";

export type PriceIngestionSourcePolicyRecord = {
  source: MarketSourceId;
  policyUrl: string | null;
  status: PriceIngestionSourcePolicyStatus;
  allowedCollectionMethod: PriceIngestionCollectionMethod;
  rateLimit: string | null;
  lastReviewedAt: string | null;
};

export type PriceIngestionSourceComplianceRecordRow = {
  id: string;
  source: MarketSourceId;
  policy_url: string;
  permission_status: PriceIngestionSourcePolicyStatus;
  allowed_collection_method: PriceIngestionCollectionMethod;
  collection_frequency_minutes: number | null;
  rate_limit_note: string;
  scheduled_collection_enabled: boolean;
  last_reviewed_at: string;
  review_notes: string;
  created_at: string;
  updated_at: string;
};

export type PriceIngestionSourceComplianceRecordInsert = {
  source: MarketSourceId;
  policy_url: string;
  permission_status?: PriceIngestionSourcePolicyStatus;
  allowed_collection_method?: PriceIngestionCollectionMethod;
  collection_frequency_minutes?: number | null;
  rate_limit_note?: string;
  scheduled_collection_enabled?: boolean;
  last_reviewed_at?: string;
  review_notes?: string;
};

export type PriceIngestionRawObservation = {
  source: MarketSourceId;
  sourceListingId: string;
  sourceUrl: string;
  observedAt: string;
  parserVersion: PriceIngestionParserVersion;
  normalizedCardCode: string;
  rawTitle: string;
  rawCondition: string | null;
  rawPriceText: string | null;
  priceJpy: number | null;
  availabilityStatus: AvailabilityStatus;
  listingKind: PriceIngestionListingKind;
  conditionScale: PriceIngestionConditionScale;
  rawTextSnapshot: string | null;
  snapshotRef: string;
  excludedReason: string | null;
  matchConfidence: PriceIngestionMatchConfidence;
  matchedVariantId: string | null;
};

export type PriceIngestionCanonicalPrice = {
  variantId: string;
  source: MarketSourceId;
  basis: PriceIngestionCanonicalPricingBasis;
  conditionScale: PriceIngestionConditionScale;
  priceJpy: number;
  observedAt: string;
  rawObservationId: string | null;
};

export type PriceIngestionCanonicalPricePointRow = {
  id: string;
  variant_id: string;
  source: MarketSourceId;
  source_day_jst: string;
  pricing_basis: PriceIngestionCanonicalPricingBasis;
  condition_scale: PriceIngestionConditionScale;
  price_jpy: number;
  observed_at: string;
  evidence_kind: PriceIngestionEvidenceKind;
  raw_observation_id: string | null;
  evidence_ref: string | null;
  selection_rank: number;
  selection_reason: string;
  derivation_version: string;
  created_at: string;
  updated_at: string;
};

export type PriceIngestionCanonicalPricePointInsert = {
  variant_id: string;
  source: MarketSourceId;
  source_day_jst: string;
  pricing_basis?: PriceIngestionCanonicalPricingBasis;
  condition_scale: PriceIngestionConditionScale;
  price_jpy: number;
  observed_at: string;
  evidence_kind?: PriceIngestionEvidenceKind;
  raw_observation_id?: string | null;
  evidence_ref?: string | null;
  selection_rank?: number;
  selection_reason?: string;
  derivation_version: string;
};

export type PriceIngestionPublishedPriceHistoryRow = {
  id: string;
  variant_id: string;
  source: MarketSourceId;
  price_jpy: number;
  availability_status: "available";
  recorded_at: string;
  canonical_price_point_id: string;
  pricing_basis: PriceIngestionCanonicalPricingBasis;
  source_day_jst: string;
  condition_scale: PriceIngestionConditionScale;
  created_at: string;
};

export type PriceIngestionPublishedPriceHistoryInsert = {
  variant_id: string;
  source: MarketSourceId;
  price_jpy: number;
  availability_status: "available";
  recorded_at: string;
  canonical_price_point_id: string;
  pricing_basis: PriceIngestionCanonicalPricingBasis;
  source_day_jst: string;
  condition_scale: PriceIngestionConditionScale;
};

export type PriceIngestionNormalizedParseOutput =
  | Record<string, unknown>
  | readonly unknown[];

export type PriceIngestionRawPriceObservationRow = {
  id: string;
  source: MarketSourceId;
  source_listing_id: string;
  source_url: string;
  observed_at: string;
  parser_version: string;
  normalized_card_code: string;
  source_variant_key: string | null;
  raw_title: string | null;
  raw_condition: string | null;
  normalized_condition: PriceIngestionConditionScale;
  raw_price_text: string | null;
  price_jpy: number | null;
  availability_status: AvailabilityStatus;
  listing_kind: PriceIngestionListingKind;
  normalized_parse_output: PriceIngestionNormalizedParseOutput | null;
  raw_text_snapshot: string | null;
  snapshot_ref: string;
  excluded_reason: string | null;
  match_confidence: PriceIngestionMatchConfidence;
  matched_variant_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PriceIngestionRawPriceObservationInsert = {
  source: MarketSourceId;
  source_listing_id: string;
  source_url: string;
  observed_at?: string;
  parser_version: string;
  normalized_card_code: string;
  source_variant_key?: string | null;
  raw_title?: string | null;
  raw_condition?: string | null;
  normalized_condition?: PriceIngestionConditionScale;
  raw_price_text?: string | null;
  price_jpy?: number | null;
  availability_status?: AvailabilityStatus;
  listing_kind?: PriceIngestionListingKind;
  normalized_parse_output?: PriceIngestionNormalizedParseOutput | null;
  raw_text_snapshot?: string | null;
  snapshot_ref: string;
  excluded_reason?: string | null;
  match_confidence?: PriceIngestionMatchConfidence;
  matched_variant_id?: string | null;
};
