import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  summarizeListingParse,
  type ConfidenceBand,
  type ListingKind,
  type ListingParseSummary
} from "@/lib/pricing/ingestion/classifier";
import { PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS } from "@/lib/pricing/ingestion/constants";
import {
  deriveCanonicalPriceCandidates,
  type PriceIngestionRawObservationInput
} from "@/lib/pricing/ingestion/derive";
import {
  normalizeConditionScale,
  normalizeListingKind
} from "@/lib/pricing/ingestion/normalize";
import { isCanonicalPricePointPublishable } from "@/lib/pricing/ingestion/repository";
import { validateCanonicalPricePointInsert } from "@/lib/pricing/ingestion/validation";
import type { PriceIngestionCanonicalPricePointRow } from "@/lib/pricing/ingestion/types";

type PriceIngestionFixtureCase = {
  id: string;
  source: string;
  source_listing_id: string;
  source_url: string;
  raw_title: string;
  raw_condition: string | null;
  raw_price_text: string | null;
  availability_status: "available" | "sold_out" | "error";
  expected: {
    normalized_card_code: string | null;
    listing_kind: ListingKind;
    variant_treatment: "standard" | "manga" | "alt_art" | "noise";
    condition: "mint" | "near_mint" | "light_play" | "moderate_play" | "damaged" | "graded" | "unknown";
    match_confidence: ConfidenceBand;
    should_enter_canonical: boolean;
    excluded_reason?: string;
  };
};

type PriceIngestionFixtureFile = {
  schema: string;
  description: string;
  cardCode: string;
  cases: PriceIngestionFixtureCase[];
};

type ValidationIssue = {
  caseId: string;
  field: string;
  expected: unknown;
  actual: unknown;
};

type ValidationSkip = {
  caseId: string;
  field: string;
  reason: string;
};

type RegressionIssue = {
  scenario: string;
  field: string;
  expected: unknown;
  actual: unknown;
};

type RegressionObservationOverrides =
  Partial<PriceIngestionRawObservationInput> &
  Pick<
    PriceIngestionRawObservationInput,
    | "sourceListingId"
    | "observedAt"
    | "conditionScale"
    | "priceJpy"
    | "availabilityStatus"
    | "listingKind"
    | "matchConfidence"
  >;

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "tests",
  "fixtures",
  "price-ingestion",
  "eb02-061-cases.json"
);

function inferVariantTreatment(summary: ListingParseSummary): "standard" | "manga" | "alt_art" | "noise" {
  if (
    summary.listingKind === "deck_product" ||
    summary.listingKind === "proxy_custom" ||
    summary.listingKind === "sealed_product" ||
    summary.listingKind === "ambiguous"
  ) {
    return "noise";
  }

  if (summary.mangaMarkers.length > 0) {
    return "manga";
  }

  if (summary.illustratorMarkers.length > 0 || summary.altArtMarkers.length > 0) {
    return "alt_art";
  }

  return "standard";
}

function inferConditionBucket(summary: ListingParseSummary): string {
  if (summary.listingKind === "graded_card") {
    return "graded";
  }

  if (/\b(psa|bgs|cgc|ars|beckett|slabbed)\b/i.test(summary.rawText) || /鑑定/.test(summary.rawText)) {
    return "graded";
  }

  return summary.conditionBucket;
}

function hasIllustratorEvidence(summary: ListingParseSummary) {
  return (
    summary.illustratorMarkers.length > 0 ||
    /\billust[:：]/i.test(summary.rawText) ||
    /\billustration[:：]/i.test(summary.rawText) ||
    /イラスト[:：]?/i.test(summary.rawText) ||
    /作画[:：]?/i.test(summary.rawText)
  );
}

function inferCanonicalEligibility(
  summary: ListingParseSummary,
  availabilityStatus: PriceIngestionFixtureCase["availability_status"]
) {
  if (availabilityStatus !== "available") {
    return { shouldEnterCanonical: false, excludedReason: "availability_status" };
  }

  if (summary.listingKind !== "single_card") {
    return {
      shouldEnterCanonical: false,
      excludedReason: summary.listingKind === "deck_product" ? "deck_product" : summary.listingKind
    };
  }

  if (summary.conditionBucket === "damaged") {
    return { shouldEnterCanonical: false, excludedReason: "damaged_condition" };
  }

  if (summary.conditionBucket === "graded") {
    return { shouldEnterCanonical: false, excludedReason: "graded_condition" };
  }

  if (summary.altArtMarkers.length > 0 && !hasIllustratorEvidence(summary)) {
    return { shouldEnterCanonical: false, excludedReason: "ambiguous_variant" };
  }

  return { shouldEnterCanonical: true, excludedReason: null };
}

function compareField<T>(
  issues: ValidationIssue[],
  caseId: string,
  field: string,
  expected: T,
  actual: T
) {
  if (expected !== actual) {
    issues.push({ caseId, field, expected, actual });
  }
}

function isSkippedField(caseId: string, field: string) {
  const skipped = new Map<string, Set<string>>([
  ]);

  return skipped.get(caseId)?.has(field) ?? false;
}

function buildRegressionObservation(
  overrides: RegressionObservationOverrides
): PriceIngestionRawObservationInput {
  return {
    source: "card_rush",
    sourceListingId: overrides.sourceListingId,
    sourceUrl: `https://example.invalid/listings/${overrides.sourceListingId}`,
    observedAt: overrides.observedAt,
    parserVersion: "price-ingestion.v1",
    normalizedCardCode: "EB02-061",
    rawTitle: `${overrides.sourceListingId} title`,
    rawCondition: overrides.conditionScale,
    rawPriceText: overrides.priceJpy === null ? null : `JPY ${overrides.priceJpy}`,
    priceJpy: overrides.priceJpy,
    availabilityStatus: overrides.availabilityStatus,
    listingKind: overrides.listingKind,
    conditionScale: overrides.conditionScale,
    rawTextSnapshot: `${overrides.sourceListingId} snapshot`,
    snapshotRef: `snapshot-${overrides.sourceListingId}`,
    excludedReason: null,
    matchConfidence: overrides.matchConfidence,
    matchedVariantId: "variant-eb02-061-standard",
    id: overrides.id ?? overrides.sourceListingId,
    sourceVariantKey: overrides.sourceVariantKey ?? "STD"
  };
}

function buildRegressionCanonicalPoint(
  overrides: Partial<PriceIngestionCanonicalPricePointRow>
): PriceIngestionCanonicalPricePointRow {
  return {
    id: "canonical-point-default",
    variant_id: "variant-eb02-061-standard",
    source: "card_rush",
    source_day_jst: "2024-04-01",
    pricing_basis: PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
    condition_scale: "mint",
    price_jpy: 1180,
    observed_at: "2024-04-01T02:00:00.000Z",
    evidence_kind: "raw_observation",
    raw_observation_id: "raw-observation-default",
    evidence_ref: "snapshot-canonical-point-default",
    selection_rank: 0,
    selection_reason: "basis regression default point",
    derivation_version: "test-regression/1",
    created_at: "2024-04-01T02:00:00.000Z",
    updated_at: "2024-04-01T02:00:00.000Z",
    ...overrides
  };
}

function addRegressionIssue(
  issues: RegressionIssue[],
  scenario: string,
  field: string,
  expected: unknown,
  actual: unknown
) {
  if (expected !== actual) {
    issues.push({ scenario, field, expected, actual });
  }
}

function addJsonRegressionIssue(
  issues: RegressionIssue[],
  scenario: string,
  field: string,
  expected: unknown,
  actual: unknown
) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    issues.push({ scenario, field, expected, actual });
  }
}

function runClassifierRuleCharacterizationChecks() {
  const issues: RegressionIssue[] = [];
  const cardCodeSummary = summarizeListingParse({
    title: "eb02 061 モンキー・D・ルフィ SEC EB02/061"
  });
  const broadMarkerCases = [
    {
      marker: "sp",
      expectedListingKind: "single_card",
      expectedNormalizeListingKind: "single_card",
      expectedAltArtMarkers: ["sp"]
    },
    {
      marker: "special",
      expectedListingKind: "single_card",
      expectedNormalizeListingKind: "single_card",
      expectedAltArtMarkers: ["special"]
    },
    {
      marker: "seal",
      expectedListingKind: "sealed_product",
      expectedNormalizeListingKind: "sealed_product",
      expectedAltArtMarkers: []
    },
    {
      marker: "box",
      expectedListingKind: "sealed_product",
      expectedNormalizeListingKind: "sealed_product",
      expectedAltArtMarkers: []
    },
    {
      marker: "pack",
      expectedListingKind: "sealed_product",
      expectedNormalizeListingKind: "sealed_product",
      expectedAltArtMarkers: []
    },
    {
      marker: "deck",
      expectedListingKind: "deck_product",
      expectedNormalizeListingKind: "deck_product",
      expectedAltArtMarkers: []
    },
    {
      marker: "copy",
      expectedListingKind: "proxy_custom",
      expectedNormalizeListingKind: "single_card",
      expectedAltArtMarkers: []
    },
    {
      marker: "print",
      expectedListingKind: "single_card",
      expectedNormalizeListingKind: "single_card",
      expectedAltArtMarkers: []
    },
    {
      marker: "custom print",
      expectedListingKind: "proxy_custom",
      expectedNormalizeListingKind: "proxy_custom",
      expectedAltArtMarkers: []
    }
  ] as const;
  const embeddedMarkerCases = [
    {
      text: "display",
      expectedListingKind: "sealed_product",
      expectedNormalizeListingKind: "single_card",
      expectedAltArtMarkers: []
    },
    {
      text: "sealed",
      expectedListingKind: "sealed_product",
      expectedNormalizeListingKind: "sealed_product",
      expectedAltArtMarkers: []
    },
    {
      text: "decklist",
      expectedListingKind: "single_card",
      expectedNormalizeListingKind: "single_card",
      expectedAltArtMarkers: []
    },
    {
      text: "deck box",
      expectedListingKind: "deck_product",
      expectedNormalizeListingKind: "deck_product",
      expectedAltArtMarkers: []
    },
    {
      text: "reprint",
      expectedListingKind: "single_card",
      expectedNormalizeListingKind: "single_card",
      expectedAltArtMarkers: []
    },
    {
      text: "copycat",
      expectedListingKind: "single_card",
      expectedNormalizeListingKind: "single_card",
      expectedAltArtMarkers: []
    },
    {
      text: "packaging",
      expectedListingKind: "single_card",
      expectedNormalizeListingKind: "single_card",
      expectedAltArtMarkers: []
    }
  ] as const;
  const japaneseMarkerCases = [
    {
      marker: "美品",
      expectedClassifierCondition: "mint",
      expectedNormalizeCondition: "mint",
      expectedClassifierListingKind: "single_card",
      expectedNormalizeListingKind: "single_card"
    },
    {
      marker: "状態A",
      expectedClassifierCondition: "mint",
      expectedNormalizeCondition: "mint",
      expectedClassifierListingKind: "single_card",
      expectedNormalizeListingKind: "single_card"
    },
    {
      marker: "状態A-",
      expectedClassifierCondition: "near_mint",
      expectedNormalizeCondition: "near_mint",
      expectedClassifierListingKind: "single_card",
      expectedNormalizeListingKind: "single_card"
    },
    {
      marker: "鑑定済",
      expectedClassifierCondition: "graded",
      expectedNormalizeCondition: "graded",
      expectedClassifierListingKind: "graded_card",
      expectedNormalizeListingKind: "graded_card"
    },
    {
      marker: "未開封",
      expectedClassifierCondition: "unknown",
      expectedNormalizeCondition: "unknown",
      expectedClassifierListingKind: "sealed_product",
      expectedNormalizeListingKind: "sealed_product"
    }
  ] as const;

  addRegressionIssue(
    issues,
    "classifier characterization: card code extraction",
    "normalized_card_code",
    "EB02-061",
    cardCodeSummary.normalizedCardCode
  );
  addRegressionIssue(
    issues,
    "classifier characterization: card code extraction",
    "deduped_card_code_count",
    1,
    cardCodeSummary.cardCodes.length
  );
  addJsonRegressionIssue(
    issues,
    "classifier characterization: illustrator marker extraction",
    "illustrator_markers",
    ["illust:Makitoshi"],
    summarizeListingParse({
      title: "EB02-061 モンキー・D・ルフィ SEC パラレル illust:Makitoshi"
    }).illustratorMarkers
  );
  addRegressionIssue(
    issues,
    "classifier characterization: illustrator-backed alt art match confidence",
    "confidence_band",
    "medium",
    summarizeListingParse({
      title: "EB02-061 モンキー・D・ルフィ SEC パラレル illust:Makitoshi",
      condition: "状態A"
    }).confidenceBand
  );
  addRegressionIssue(
    issues,
    "classifier characterization: ambiguous alt art match confidence",
    "confidence_band",
    "low",
    summarizeListingParse({
      title: "EB02-061 モンキー・D・ルフィ SEC パラレル",
      condition: "状態A"
    }).confidenceBand
  );

  for (const testCase of broadMarkerCases) {
    const summary = summarizeListingParse({
      title: `EB02-061 モンキー・D・ルフィ SEC ${testCase.marker}`
    });

    addRegressionIssue(
      issues,
      `classifier characterization: broad marker ${testCase.marker}`,
      "listing_kind",
      testCase.expectedListingKind,
      summary.listingKind
    );
    addRegressionIssue(
      issues,
      `classifier characterization: broad marker ${testCase.marker}`,
      "normalize_listing_kind",
      testCase.expectedNormalizeListingKind,
      normalizeListingKind(testCase.marker)
    );
    addJsonRegressionIssue(
      issues,
      `classifier characterization: broad marker ${testCase.marker}`,
      "alt_art_markers",
      testCase.expectedAltArtMarkers,
      summary.altArtMarkers
    );
  }

  for (const testCase of embeddedMarkerCases) {
    const summary = summarizeListingParse({
      title: `EB02-061 モンキー・D・ルフィ SEC ${testCase.text}`
    });

    addRegressionIssue(
      issues,
      `classifier characterization: embedded marker ${testCase.text}`,
      "listing_kind",
      testCase.expectedListingKind,
      summary.listingKind
    );
    addRegressionIssue(
      issues,
      `classifier characterization: embedded marker ${testCase.text}`,
      "normalize_listing_kind",
      testCase.expectedNormalizeListingKind,
      normalizeListingKind(testCase.text)
    );
    addJsonRegressionIssue(
      issues,
      `classifier characterization: embedded marker ${testCase.text}`,
      "alt_art_markers",
      testCase.expectedAltArtMarkers,
      summary.altArtMarkers
    );
  }

  for (const testCase of japaneseMarkerCases) {
    const summary = summarizeListingParse({
      title: `EB02-061 モンキー・D・ルフィ SEC ${testCase.marker}`
    });

    addRegressionIssue(
      issues,
      `classifier characterization: Japanese marker ${testCase.marker}`,
      "classifier_condition",
      testCase.expectedClassifierCondition,
      summary.conditionBucket
    );
    addRegressionIssue(
      issues,
      `classifier characterization: Japanese marker ${testCase.marker}`,
      "normalize_condition",
      testCase.expectedNormalizeCondition,
      normalizeConditionScale(testCase.marker)
    );
    addRegressionIssue(
      issues,
      `classifier characterization: Japanese marker ${testCase.marker}`,
      "classifier_listing_kind",
      testCase.expectedClassifierListingKind,
      summary.listingKind
    );
    addRegressionIssue(
      issues,
      `classifier characterization: Japanese marker ${testCase.marker}`,
      "normalize_listing_kind",
      testCase.expectedNormalizeListingKind,
      normalizeListingKind(testCase.marker)
    );
  }

  return issues;
}

function runCanonicalBasisRegressionChecks() {
  const issues: RegressionIssue[] = [];
  const sameDayBase = "2024-04-01T00:00:00.000Z";
  const excludedObservationOverrides: RegressionObservationOverrides[] = [
    {
      sourceListingId: "sold-out-row",
      observedAt: sameDayBase,
      conditionScale: "mint",
      priceJpy: null,
      availabilityStatus: "sold_out",
      listingKind: "single_card",
      matchConfidence: "high"
    },
    {
      sourceListingId: "damaged-row",
      observedAt: sameDayBase,
      conditionScale: "damaged",
      priceJpy: 420,
      availabilityStatus: "available",
      listingKind: "single_card",
      matchConfidence: "high"
    },
    {
      sourceListingId: "graded-row",
      observedAt: sameDayBase,
      conditionScale: "graded",
      priceJpy: 2400,
      availabilityStatus: "available",
      listingKind: "graded_card",
      matchConfidence: "high"
    },
    {
      sourceListingId: "deck-row",
      observedAt: sameDayBase,
      conditionScale: "near_mint",
      priceJpy: 300,
      availabilityStatus: "available",
      listingKind: "deck_product",
      matchConfidence: "high"
    },
    {
      sourceListingId: "proxy-row",
      observedAt: sameDayBase,
      conditionScale: "near_mint",
      priceJpy: 300,
      availabilityStatus: "available",
      listingKind: "proxy_custom",
      matchConfidence: "high"
    },
    {
      sourceListingId: "ambiguous-row",
      observedAt: sameDayBase,
      conditionScale: "near_mint",
      priceJpy: 300,
      availabilityStatus: "available",
      listingKind: "ambiguous",
      matchConfidence: "high"
    }
  ];
  const observations = [
    buildRegressionObservation({
      sourceListingId: "eligible-near-mint-newer",
      observedAt: "2024-04-01T06:00:00.000Z",
      conditionScale: "near_mint",
      priceJpy: 980,
      availabilityStatus: "available",
      listingKind: "single_card",
      matchConfidence: "high"
    }),
    buildRegressionObservation({
      sourceListingId: "eligible-mint-older",
      observedAt: "2024-04-01T02:00:00.000Z",
      conditionScale: "mint",
      priceJpy: 1180,
      availabilityStatus: "available",
      listingKind: "single_card",
      matchConfidence: "high"
    }),
    ...excludedObservationOverrides.map((overrides) =>
      buildRegressionObservation(overrides)
    )
  ];

  const defaultCandidates = deriveCanonicalPriceCandidates({ observations });
  const explicitNewCandidates = deriveCanonicalPriceCandidates({
    observations,
    basis: "daily_best_available_ungraded_best_condition_jst"
  });
  const legacyCandidates = deriveCanonicalPriceCandidates({
    observations,
    basis: "daily_best_available_jst"
  });

  addRegressionIssue(
    issues,
    "default basis",
    "candidate_count",
    1,
    defaultCandidates.length
  );
  addRegressionIssue(
    issues,
    "default basis",
    "selected_listing_id",
    "eligible-mint-older",
    defaultCandidates[0]?.observation.sourceListingId ?? null
  );
  addRegressionIssue(
    issues,
    "default basis",
    "basis",
    PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
    defaultCandidates[0]?.basis ?? null
  );
  addRegressionIssue(
    issues,
    "default basis",
    "selection_reason",
    true,
    defaultCandidates[0]?.selectionReason.includes(
      PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS
    ) ?? false
  );
  addRegressionIssue(
    issues,
    "default basis",
    "matches_explicit_new_basis",
    explicitNewCandidates[0]?.observation.sourceListingId ?? null,
    defaultCandidates[0]?.observation.sourceListingId ?? null
  );
  addRegressionIssue(
    issues,
    "legacy basis",
    "selected_listing_id",
    "eligible-near-mint-newer",
    legacyCandidates[0]?.observation.sourceListingId ?? null
  );

  for (const excludedOverrides of excludedObservationOverrides) {
    const excludedOnlyCandidates = deriveCanonicalPriceCandidates({
      observations: [buildRegressionObservation(excludedOverrides)]
    });

    addRegressionIssue(
      issues,
      "exclusions",
      excludedOverrides.sourceListingId,
      0,
      excludedOnlyCandidates.length
    );
  }

  return issues;
}

function runPublisherEligibilityRegressionChecks() {
  const issues: RegressionIssue[] = [];
  const authorizedFeedWithoutEvidenceIssues = validateCanonicalPricePointInsert({
    variant_id: "variant-eb02-061-standard",
    source: "card_rush",
    source_day_jst: "2024-04-01",
    condition_scale: "mint",
    price_jpy: 1180,
    observed_at: "2024-04-01T02:00:00.000Z",
    evidence_kind: "authorized_feed",
    raw_observation_id: null,
    derivation_version: "test-regression/1"
  });

  addRegressionIssue(
    issues,
    "publisher eligibility",
    "default_raw_observation_basis",
    true,
    isCanonicalPricePointPublishable(buildRegressionCanonicalPoint({}))
  );
  addRegressionIssue(
    issues,
    "publisher eligibility",
    "legacy_basis",
    false,
    isCanonicalPricePointPublishable(
      buildRegressionCanonicalPoint({
        id: "canonical-point-legacy",
        pricing_basis: "daily_best_available_jst"
      })
    )
  );
  addRegressionIssue(
    issues,
    "canonical point validation",
    "authorized_feed_requires_evidence_ref",
    true,
    authorizedFeedWithoutEvidenceIssues.some(
      (issue) => issue.field === "evidence_ref"
    )
  );
  addRegressionIssue(
    issues,
    "publisher eligibility",
    "authorized_feed_default",
    false,
    isCanonicalPricePointPublishable(
      buildRegressionCanonicalPoint({
        id: "canonical-point-authorized-feed",
        evidence_kind: "authorized_feed",
        raw_observation_id: null,
        evidence_ref: "authorized-feed/default-basis"
      })
    )
  );
  addRegressionIssue(
    issues,
    "publisher eligibility",
    "authorized_feed_explicitly_allowed",
    true,
    isCanonicalPricePointPublishable(
      buildRegressionCanonicalPoint({
        id: "canonical-point-authorized-feed-allowed",
        evidence_kind: "authorized_feed",
        raw_observation_id: null,
        evidence_ref: "authorized-feed/default-basis"
      }),
      { allowAuthorizedFeedEvidence: true }
    )
  );
  addRegressionIssue(
    issues,
    "publisher eligibility",
    "raw_observation_requires_lineage",
    false,
    isCanonicalPricePointPublishable(
      buildRegressionCanonicalPoint({
        id: "canonical-point-missing-lineage",
        raw_observation_id: null
      })
    )
  );

  return issues;
}

async function main() {
  const raw = await readFile(fixturePath, "utf8");
  const fixture = JSON.parse(raw) as PriceIngestionFixtureFile;
  const issues: ValidationIssue[] = [];
  const skips: ValidationSkip[] = [];

  if (fixture.schema !== "price-ingestion-fixture/v1") {
    throw new Error(`Unsupported fixture schema: ${fixture.schema}`);
  }

  for (const testCase of fixture.cases) {
    const summary = summarizeListingParse({
      title: testCase.raw_title,
      condition: testCase.raw_condition,
      priceText: testCase.raw_price_text,
      sourceUrl: testCase.source_url
    });

    const canonicalEligibility = inferCanonicalEligibility(summary, testCase.availability_status);
    const variantTreatment = inferVariantTreatment(summary);

    compareField(
      issues,
      testCase.id,
      "normalized_card_code",
      testCase.expected.normalized_card_code,
      summary.normalizedCardCode
    );
    compareField(issues, testCase.id, "listing_kind", testCase.expected.listing_kind, summary.listingKind);
    compareField(
      issues,
      testCase.id,
      "variant_treatment",
      testCase.expected.variant_treatment,
      variantTreatment
    );
    compareField(
      issues,
      testCase.id,
      "condition",
      testCase.expected.condition,
      inferConditionBucket(summary)
    );
    compareField(
      issues,
      testCase.id,
      "match_confidence",
      testCase.expected.match_confidence,
      summary.confidenceBand
    );
    compareField(
      issues,
      testCase.id,
      "should_enter_canonical",
      testCase.expected.should_enter_canonical,
      canonicalEligibility.shouldEnterCanonical
    );

    if (testCase.expected.excluded_reason !== undefined) {
      compareField(
        issues,
        testCase.id,
        "excluded_reason",
        testCase.expected.excluded_reason,
        canonicalEligibility.excludedReason
      );
    }
  }

  const supportedIssues = issues.filter((issue) => !isSkippedField(issue.caseId, issue.field));
  const skippedIssues = issues.filter((issue) => isSkippedField(issue.caseId, issue.field));
  const regressionIssues = [
    ...runClassifierRuleCharacterizationChecks(),
    ...runCanonicalBasisRegressionChecks(),
    ...runPublisherEligibilityRegressionChecks()
  ];

  for (const skipped of skippedIssues) {
    skips.push({
      caseId: skipped.caseId,
      field: skipped.field,
      reason: "current helper surface does not model this expectation precisely"
    });
  }

  if (supportedIssues.length === 0) {
    if (regressionIssues.length === 0) {
      console.log(
        `Validated ${fixture.cases.length} fixture cases, classifier rule characterization checks, canonical basis checks, and publisher eligibility checks.`
      );

      if (skips.length > 0) {
        console.log(
          `Skipped ${skips.length} unsupported expectation${skips.length === 1 ? "" : "s"}:`
        );
        for (const skip of skips) {
          console.log(`- ${skip.caseId} :: ${skip.field} (${skip.reason})`);
        }
      }

      return;
    }
  }

  if (supportedIssues.length > 0) {
    console.error(
      `Found ${supportedIssues.length} validation issue${supportedIssues.length === 1 ? "" : "s"}:`
    );

    for (const issue of supportedIssues) {
      console.error(
        `- ${issue.caseId} :: ${issue.field} expected ${JSON.stringify(issue.expected)} got ${JSON.stringify(issue.actual)}`
      );
    }
  }

  if (regressionIssues.length > 0) {
    console.error(
      `Found ${regressionIssues.length} regression or characterization issue${regressionIssues.length === 1 ? "" : "s"}:`
    );

    for (const issue of regressionIssues) {
      console.error(
        `- ${issue.scenario} :: ${issue.field} expected ${JSON.stringify(issue.expected)} got ${JSON.stringify(issue.actual)}`
      );
    }
  }

  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
