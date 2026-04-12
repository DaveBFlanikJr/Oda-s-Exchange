import type { AvailabilityStatus, MarketSourceId } from "@/lib/types/market";
import type {
  PriceIngestionCanonicalPricingBasis,
  PriceIngestionCollectionMethod,
  PriceIngestionConditionScale,
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
