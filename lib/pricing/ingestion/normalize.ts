import {
  PRICE_INGESTION_CONDITION_SCALES,
  PRICE_INGESTION_LISTING_KINDS,
  PRICE_INGESTION_SOURCE_POLICY_STATUSES,
  type PriceIngestionConditionScale,
  type PriceIngestionListingKind,
  type PriceIngestionSourcePolicyStatus
} from "@/lib/pricing/ingestion/constants";
import {
  matchesRegexRule,
  matchesTextTokenRule,
  NORMALIZE_AMBIGUOUS_LISTING_MARKERS,
  NORMALIZE_CONDITION_RULES,
  NORMALIZE_LISTING_KIND_RULES,
  NORMALIZE_SOURCE_POLICY_STATUS_RULES,
  normalizeCoercionText
} from "@/lib/pricing/ingestion/rules";

export function normalizeSourcePolicyStatus(
  value: string | null | undefined
): PriceIngestionSourcePolicyStatus {
  const normalized = normalizeCoercionText(value);

  if (
    PRICE_INGESTION_SOURCE_POLICY_STATUSES.includes(
      normalized as PriceIngestionSourcePolicyStatus
    )
  ) {
    return normalized as PriceIngestionSourcePolicyStatus;
  }

  for (const rule of NORMALIZE_SOURCE_POLICY_STATUS_RULES) {
    if (matchesTextTokenRule(normalized, rule)) {
      return rule.output;
    }
  }

  return "unknown";
}

export function normalizeConditionScale(
  value: string | null | undefined
): PriceIngestionConditionScale {
  const normalized = normalizeCoercionText(value);

  if (normalized === "") {
    return "unknown";
  }

  for (const rule of NORMALIZE_CONDITION_RULES) {
    if (matchesRegexRule(normalized, rule)) {
      return rule.output;
    }
  }

  return "unknown";
}

export function normalizeListingKind(
  value: string | null | undefined
): PriceIngestionListingKind {
  const normalized = normalizeCoercionText(value);

  if (normalized === "") {
    return "unknown";
  }

  for (const rule of NORMALIZE_LISTING_KIND_RULES) {
    if (matchesRegexRule(normalized, rule)) {
      return rule.output;
    }
  }

  const conditionScale = normalizeConditionScale(normalized);
  if (conditionScale !== "unknown") {
    return "single_card";
  }

  const hasAmbiguousMarkers = NORMALIZE_AMBIGUOUS_LISTING_MARKERS.some(
    (marker) => normalized.includes(marker)
  );
  if (hasAmbiguousMarkers) {
    return "ambiguous";
  }

  if (
    PRICE_INGESTION_LISTING_KINDS.includes(
      normalized as PriceIngestionListingKind
    )
  ) {
    return normalized as PriceIngestionListingKind;
  }

  return "single_card";
}
