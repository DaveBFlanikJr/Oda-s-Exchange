import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
  PRICE_INGESTION_PARSER_VERSION,
  type PriceIngestionCanonicalPricingBasis,
  type PriceIngestionConditionScale,
  type PriceIngestionListingKind,
  type PriceIngestionMatchConfidence
} from "@/lib/pricing/ingestion/constants";
import {
  deriveCanonicalPriceCandidates,
  type PriceIngestionRawObservationInput
} from "@/lib/pricing/ingestion/derive";
import type { AvailabilityStatus } from "@/lib/types/market";

export type ManualFixtureCase = {
  id: string;
  source_listing_id: string;
  source_url: string;
  source_variant_key: string | null;
  raw_title: string;
  raw_condition: string | null;
  raw_price_text: string | null;
  availability_status: AvailabilityStatus;
  raw_text_snapshot: string;
  snapshot_ref: string;
  expected: {
    normalized_card_code: string;
    listing_kind: PriceIngestionListingKind;
    condition: PriceIngestionConditionScale;
    match_confidence: PriceIngestionMatchConfidence;
    excluded_reason?: string;
    should_insert_raw: boolean;
    should_publish_canonical: boolean;
  };
};

export type ManualFixtureExpectedCanonicalSelection = {
  pricing_basis: PriceIngestionCanonicalPricingBasis;
  source_listing_id: string;
  source_variant_key: string;
  condition: PriceIngestionConditionScale;
  source_day_jst: string;
};

export type ManualFixture = {
  schema: string;
  description: string;
  source: "card_rush";
  sourcePolicyUrl: string;
  captureMethod: "manual_fixture";
  cardCode: string;
  observedAt: string;
  parserVersion: string;
  expectedCanonicalSelections: ManualFixtureExpectedCanonicalSelection[];
  cases: ManualFixtureCase[];
};

export type ManualCoverageReaderSurface =
  | "catalog"
  | "card_detail"
  | "api_prices";

export type ManualCoverageManifestFixture = {
  path: string;
  coverage: {
    cardCode: string;
    expectedOutcome: "published_history" | "no_qualifying_rows";
    readerSurfaces: ManualCoverageReaderSurface[];
    notes?: string;
  };
};

export type ManualCoverageManifest = {
  schema: string;
  description: string;
  source: "card_rush";
  pricingBasis: PriceIngestionCanonicalPricingBasis;
  reconciliation: {
    strategy: "constrained_publish_window";
    assumptions: string[];
  };
  fixtures: ManualCoverageManifestFixture[];
};

export const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

export const defaultManualFixturePath = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "price-ingestion",
  "card-rush-manual-ingestion-eb02-061.json"
);

export const defaultManualCoverageManifestPath = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "price-ingestion",
  "card-rush-manual-publish-coverage.json"
);

function resolveRepoPath(targetPath: string) {
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(repoRoot, targetPath);
}

async function readJsonFile<T>(targetPath: string) {
  return JSON.parse(await readFile(targetPath, "utf8")) as T;
}

export async function loadManualFixture(fixturePath: string) {
  const resolvedPath = resolveRepoPath(fixturePath);
  const fixture = await readJsonFile<ManualFixture>(resolvedPath);

  if (fixture.schema !== "card-rush-manual-ingestion-fixture/v1") {
    throw new Error(`Unsupported fixture schema: ${fixture.schema}`);
  }

  if (fixture.source !== "card_rush") {
    throw new Error(`Unsupported fixture source: ${fixture.source}`);
  }

  if (
    fixture.sourcePolicyUrl !== "https://cardrush.media/data_policy" ||
    fixture.captureMethod !== "manual_fixture"
  ) {
    throw new Error(
      "Card Rush fixture must preserve the approved policy URL and manual_fixture capture method."
    );
  }

  if (!Array.isArray(fixture.expectedCanonicalSelections)) {
    throw new Error("Fixture must define expectedCanonicalSelections as an array.");
  }

  return fixture;
}

export async function loadManualCoverageManifest(manifestPath: string) {
  const resolvedPath = resolveRepoPath(manifestPath);
  const manifest = await readJsonFile<ManualCoverageManifest>(resolvedPath);

  if (manifest.schema !== "card-rush-manual-publish-coverage/v1") {
    throw new Error(`Unsupported manual coverage manifest schema: ${manifest.schema}`);
  }

  if (manifest.source !== "card_rush") {
    throw new Error(`Unsupported manual coverage manifest source: ${manifest.source}`);
  }

  return manifest;
}

export function getManualPublishDayJst(timestamp: string) {
  const time = Date.parse(timestamp);

  if (!Number.isFinite(time)) {
    return null;
  }

  return new Date(time + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function parseFixturePriceJpy(
  rawPriceText: string | null,
  availabilityStatus: AvailabilityStatus
) {
  if (availabilityStatus !== "available") {
    return null;
  }

  const digits = rawPriceText?.replace(/[^\d]/g, "") ?? "";

  if (!digits) {
    return null;
  }

  const price = Number.parseInt(digits, 10);
  return Number.isSafeInteger(price) ? price : null;
}

export function toFixtureDerivationObservation(
  fixture: ManualFixture,
  testCase: ManualFixtureCase
): PriceIngestionRawObservationInput {
  return {
    id: testCase.id,
    source: fixture.source,
    sourceListingId: testCase.source_listing_id,
    sourceUrl: testCase.source_url,
    observedAt: fixture.observedAt,
    parserVersion: PRICE_INGESTION_PARSER_VERSION,
    normalizedCardCode: fixture.cardCode,
    rawTitle: testCase.raw_title,
    rawCondition: testCase.raw_condition,
    rawPriceText: testCase.raw_price_text,
    priceJpy: parseFixturePriceJpy(
      testCase.raw_price_text,
      testCase.availability_status
    ),
    availabilityStatus: testCase.availability_status,
    listingKind: testCase.expected.listing_kind,
    conditionScale: testCase.expected.condition,
    rawTextSnapshot: testCase.raw_text_snapshot,
    snapshotRef: testCase.snapshot_ref,
    excludedReason: testCase.expected.excluded_reason ?? null,
    matchConfidence: testCase.expected.match_confidence,
    matchedVariantId: testCase.source_variant_key
      ? `fixture-variant-${testCase.source_variant_key}`
      : null,
    sourceVariantKey: testCase.source_variant_key
  };
}

export function deriveFixtureCanonicalCandidates(fixture: ManualFixture) {
  return deriveCanonicalPriceCandidates({
    basis: PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
    observations: fixture.cases.map((testCase) =>
      toFixtureDerivationObservation(fixture, testCase)
    )
  });
}

export function groupPublishableFixtureCases(fixture: ManualFixture) {
  const groups = new Map<string, ManualFixtureCase[]>();
  const sourceDayJst = getManualPublishDayJst(fixture.observedAt);

  if (!sourceDayJst) {
    return groups;
  }

  for (const testCase of fixture.cases) {
    if (!testCase.expected.should_publish_canonical || !testCase.source_variant_key) {
      continue;
    }

    const key = `${testCase.source_variant_key}::${sourceDayJst}`;
    const cases = groups.get(key) ?? [];
    cases.push(testCase);
    groups.set(key, cases);
  }

  return groups;
}

export function countPublishableFixtureCases(fixture: ManualFixture) {
  return fixture.cases.filter((testCase) => testCase.expected.should_publish_canonical)
    .length;
}

