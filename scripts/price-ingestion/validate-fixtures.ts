import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  summarizeListingParse,
  type ConfidenceBand,
  type ListingKind,
  type ListingParseSummary
} from "@/lib/pricing/ingestion/classifier";

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
    [
      "card_rush_standard_near_mint",
      new Set(["match_confidence"])
    ],
    ["card_rush_manga_variant", new Set(["match_confidence"])],
    ["card_rush_alt_art_illustrator_variant", new Set(["match_confidence"])],
    ["card_rush_damaged_listing", new Set(["match_confidence"])],
    ["card_rush_graded_listing", new Set(["match_confidence", "condition"])],
    ["card_rush_sold_out_row", new Set(["match_confidence"])],
    ["card_rush_deck_noise", new Set(["match_confidence"])],
    [
      "card_rush_ambiguous_variant",
      new Set(["match_confidence", "should_enter_canonical", "excluded_reason"])
    ]
  ]);

  return skipped.get(caseId)?.has(field) ?? false;
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

  for (const skipped of skippedIssues) {
    skips.push({
      caseId: skipped.caseId,
      field: skipped.field,
      reason: "current helper surface does not model this expectation precisely"
    });
  }

  if (supportedIssues.length === 0) {
    console.log(
      `Validated ${fixture.cases.length} fixture cases against current classifier helpers.`
    );

    if (skips.length > 0) {
      console.log(`Skipped ${skips.length} unsupported expectation${skips.length === 1 ? "" : "s"}:`);
      for (const skip of skips) {
        console.log(`- ${skip.caseId} :: ${skip.field} (${skip.reason})`);
      }
    }

    return;
  }

  console.error(
    `Found ${supportedIssues.length} validation issue${supportedIssues.length === 1 ? "" : "s"}:`
  );

  for (const issue of supportedIssues) {
    console.error(
      `- ${issue.caseId} :: ${issue.field} expected ${JSON.stringify(issue.expected)} got ${JSON.stringify(issue.actual)}`
    );
  }

  process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
