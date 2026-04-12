import {
  PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
  type PriceIngestionCanonicalPricingBasis,
  type PriceIngestionConditionScale,
  type PriceIngestionMatchConfidence
} from "@/lib/pricing/ingestion/constants";
import type {
  PriceIngestionCanonicalPrice,
  PriceIngestionRawObservation
} from "@/lib/pricing/ingestion/types";

export type PriceIngestionRawObservationInput = PriceIngestionRawObservation & {
  id?: string | null;
  sourceVariantKey?: string | null;
};

export type PriceIngestionCanonicalCandidateInput = {
  observations: readonly PriceIngestionRawObservationInput[];
  basis?: PriceIngestionCanonicalPricingBasis;
};

export type PriceIngestionCanonicalCandidate = PriceIngestionCanonicalPrice & {
  sourceDayJst: string;
  selectionRank: number;
  selectionReason: string;
  observation: PriceIngestionRawObservationInput;
};

type ObservationGroupKey = `${string}::${string}::${string}`;

const EXCLUDED_LISTING_KINDS = new Set<string>([
  "graded_card",
  "sealed_product",
  "deck_product",
  "proxy_custom",
  "ambiguous"
] as const);

const ELIGIBLE_CONFIDENCES: ReadonlySet<PriceIngestionMatchConfidence> = new Set([
  "medium",
  "high"
]);

const CONDITION_PRIORITY: Record<PriceIngestionConditionScale, number> = {
  mint: 0,
  near_mint: 1,
  light_play: 2,
  moderate_play: 3,
  unknown: 4,
  damaged: 5,
  graded: 6
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function toJstDayKey(timestamp: string) {
  const time = Date.parse(timestamp);

  if (!Number.isFinite(time)) {
    return null;
  }

  return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function groupKey(variantId: string, source: string, day: string): ObservationGroupKey {
  return `${variantId}::${source}::${day}`;
}

function isUngradedCondition(conditionScale: PriceIngestionConditionScale) {
  return conditionScale !== "damaged" && conditionScale !== "graded";
}

function getConditionPriority(conditionScale: PriceIngestionConditionScale) {
  return CONDITION_PRIORITY[conditionScale];
}

function compareObservationForDailyBestAvailable(
  left: PriceIngestionRawObservationInput,
  right: PriceIngestionRawObservationInput
) {
  const leftObservedAt = Date.parse(left.observedAt);
  const rightObservedAt = Date.parse(right.observedAt);

  if (leftObservedAt !== rightObservedAt) {
    return rightObservedAt - leftObservedAt;
  }

  const leftConfidence = left.matchConfidence === "high" ? 1 : 0;
  const rightConfidence = right.matchConfidence === "high" ? 1 : 0;

  if (leftConfidence !== rightConfidence) {
    return rightConfidence - leftConfidence;
  }

  const leftPriority = getConditionPriority(left.conditionScale);
  const rightPriority = getConditionPriority(right.conditionScale);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return left.sourceListingId.localeCompare(right.sourceListingId);
}

function compareObservationForUngradedBestCondition(
  left: PriceIngestionRawObservationInput,
  right: PriceIngestionRawObservationInput
) {
  const leftPriority = getConditionPriority(left.conditionScale);
  const rightPriority = getConditionPriority(right.conditionScale);

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftObservedAt = Date.parse(left.observedAt);
  const rightObservedAt = Date.parse(right.observedAt);

  if (leftObservedAt !== rightObservedAt) {
    return rightObservedAt - leftObservedAt;
  }

  const leftConfidence = left.matchConfidence === "high" ? 1 : 0;
  const rightConfidence = right.matchConfidence === "high" ? 1 : 0;

  if (leftConfidence !== rightConfidence) {
    return rightConfidence - leftConfidence;
  }

  return left.sourceListingId.localeCompare(right.sourceListingId);
}

function buildSelectionReason(
  basis: PriceIngestionCanonicalPricingBasis,
  observation: PriceIngestionRawObservationInput
) {
  const parts = [`basis ${basis}`];

  if (basis === "daily_best_available_jst") {
    parts.push("latest eligible observation in JST day");
  } else {
    parts.push("best eligible ungraded condition in JST day");
  }

  parts.push(`condition=${observation.conditionScale}`);
  parts.push(`confidence=${observation.matchConfidence}`);

  return parts.join("; ");
}

function isEligibleForCanonicalSelection(
  observation: PriceIngestionRawObservationInput
) {
  if (!isFiniteNumber(observation.priceJpy) || observation.priceJpy <= 0) {
    return false;
  }

  if (observation.availabilityStatus !== "available") {
    return false;
  }

  if (!ELIGIBLE_CONFIDENCES.has(observation.matchConfidence)) {
    return false;
  }

  if (!observation.matchedVariantId) {
    return false;
  }

  if (EXCLUDED_LISTING_KINDS.has(observation.listingKind)) {
    return false;
  }

  if (
    observation.conditionScale === "damaged" ||
    observation.conditionScale === "graded"
  ) {
    return false;
  }

  return true;
}

function isBasisEligible(
  observation: PriceIngestionRawObservationInput,
  basis: PriceIngestionCanonicalPricingBasis
) {
  if (!isEligibleForCanonicalSelection(observation)) {
    return false;
  }

  if (basis === "daily_best_available_ungraded_best_condition_jst") {
    return isUngradedCondition(observation.conditionScale);
  }

  return true;
}

function selectObservationForGroup(
  observations: readonly PriceIngestionRawObservationInput[],
  basis: PriceIngestionCanonicalPricingBasis
) {
  if (observations.length === 0) {
    return null;
  }

  const sorted = [...observations].sort(
    basis === "daily_best_available_ungraded_best_condition_jst"
      ? compareObservationForUngradedBestCondition
      : compareObservationForDailyBestAvailable
  );

  return sorted[0] ?? null;
}

export function deriveCanonicalPriceCandidates(
  input: PriceIngestionCanonicalCandidateInput
): PriceIngestionCanonicalCandidate[] {
  const basis = input.basis ?? PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS;
  const eligibleObservations = input.observations.filter((observation) =>
    isBasisEligible(observation, basis)
  );
  const groups = new Map<ObservationGroupKey, PriceIngestionRawObservationInput[]>();

  for (const observation of eligibleObservations) {
    const sourceDayJst = toJstDayKey(observation.observedAt);

    if (!sourceDayJst) {
      continue;
    }

    const matchedVariantId = observation.matchedVariantId;

    if (!matchedVariantId) {
      continue;
    }

    const key = groupKey(matchedVariantId, observation.source, sourceDayJst);
    const groupedObservations = groups.get(key);

    if (groupedObservations) {
      groupedObservations.push(observation);
    } else {
      groups.set(key, [observation]);
    }
  }

  const candidates: PriceIngestionCanonicalCandidate[] = [];

  for (const [key, groupObservations] of groups.entries()) {
    const selectedObservation = selectObservationForGroup(groupObservations, basis);

    if (!selectedObservation) {
      continue;
    }

    const [, , sourceDayJst] = key.split("::") as [string, string, string];

    candidates.push({
      variantId: selectedObservation.matchedVariantId!,
      source: selectedObservation.source,
      basis,
      conditionScale: selectedObservation.conditionScale,
      priceJpy: selectedObservation.priceJpy!,
      observedAt: selectedObservation.observedAt,
      rawObservationId: selectedObservation.id ?? null,
      sourceDayJst,
      selectionRank: getConditionPriority(selectedObservation.conditionScale),
      selectionReason: buildSelectionReason(basis, selectedObservation),
      observation: selectedObservation
    });
  }

  return candidates.sort((left, right) => {
    const dayCompare = right.sourceDayJst.localeCompare(left.sourceDayJst);

    if (dayCompare !== 0) {
      return dayCompare;
    }

    const sourceCompare = left.source.localeCompare(right.source);

    if (sourceCompare !== 0) {
      return sourceCompare;
    }

    const variantCompare = left.variantId.localeCompare(right.variantId);

    if (variantCompare !== 0) {
      return variantCompare;
    }

    const observedAtCompare = Date.parse(right.observedAt) - Date.parse(left.observedAt);

    if (observedAtCompare !== 0) {
      return observedAtCompare;
    }

    return left.selectionRank - right.selectionRank;
  });
}

export function deriveCanonicalPriceCandidate(
  input: PriceIngestionCanonicalCandidateInput
) {
  return deriveCanonicalPriceCandidates(input)[0] ?? null;
}
