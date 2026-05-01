import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
  PRICE_INGESTION_PARSER_VERSION
} from "@/lib/pricing/ingestion/constants";
import { deriveCanonicalPriceCandidates } from "@/lib/pricing/ingestion/derive";
import {
  getPriceIngestionAdminSupabaseClient,
  getSourceComplianceRecordBySource,
  insertRawPriceObservations,
  publishCanonicalPricePointsToPriceHistory,
  upsertCanonicalPricePoints,
  type PriceIngestionAdminSupabaseClient
} from "@/lib/pricing/ingestion/repository";
import type {
  PriceIngestionCanonicalPricePointInsert,
  PriceIngestionRawObservation,
  PriceIngestionRawPriceObservationInsert,
  PriceIngestionRawPriceObservationRow
} from "@/lib/pricing/ingestion/types";
import {
  deriveFixtureCanonicalCandidates,
  defaultManualFixturePath,
  loadManualFixture,
  parseFixturePriceJpy,
  type ManualFixture,
  type ManualFixtureCase
} from "@/scripts/price-ingestion/manual-publish-fixtures";

type CliOptions = {
  fixturePath: string;
  publish: boolean;
};

type VariantRow = {
  id: string;
  card_id: string;
  source_variant_key: string;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

function printUsage() {
  console.log("Usage: pnpm ingest:card-rush-fixture [--fixture <path>] [--publish]");
  console.log("");
  console.log("Reads a committed local Card Rush manual fixture and writes raw observations.");
  console.log("Publishing to price_history only happens when --publish is provided.");
}

function parseArgs(argv: string[]): CliOptions {
  let fixturePath = defaultManualFixturePath;
  let publish = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--publish") {
      publish = true;
      continue;
    }

    if (arg === "--fixture" || arg === "-f") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --fixture.");
      }
      fixturePath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--fixture=")) {
      fixturePath = arg.slice("--fixture=".length);
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return {
    fixturePath: path.resolve(repoRoot, fixturePath),
    publish
  };
}

function requireServiceRoleCredentials() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Manual fixture ingestion requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }
}

async function verifyCardRushCompliance(supabase: PriceIngestionAdminSupabaseClient) {
  const compliance = await getSourceComplianceRecordBySource("card_rush", supabase);

  if (!compliance) {
    throw new Error("Missing Card Rush source_compliance_records row.");
  }

  const isManualFixtureOnly =
    compliance.policy_url === "https://cardrush.media/data_policy" &&
    compliance.permission_status === "restricted" &&
    compliance.allowed_collection_method === "manual_fixture" &&
    compliance.scheduled_collection_enabled === false;

  if (!isManualFixtureOnly) {
    throw new Error(
      [
        "Card Rush compliance gate failed.",
        "Expected restricted/manual_fixture with scheduled_collection_enabled=false before ingestion."
      ].join(" ")
    );
  }
}

async function loadVariantMap(
  fixture: ManualFixture,
  supabase: PriceIngestionAdminSupabaseClient
) {
  const sourceVariantKeys = [
    ...new Set(
      fixture.cases
        .map((testCase) => testCase.source_variant_key)
        .filter((key): key is string => typeof key === "string" && key.length > 0)
    )
  ];

  if (sourceVariantKeys.length === 0) {
    return new Map<string, VariantRow>();
  }

  const { data, error } = await supabase
    .from("card_variants")
    .select("id, card_id, source_variant_key")
    .eq("card_id", fixture.cardCode)
    .in("source_variant_key", sourceVariantKeys);

  if (error) {
    throw new Error(`Failed to resolve fixture variants: ${error.message}`);
  }

  const variants = ((data ?? []) as VariantRow[]).filter(
    (variant) => variant.card_id === fixture.cardCode
  );
  const variantMap = new Map(
    variants.map((variant) => [variant.source_variant_key, variant])
  );

  for (const sourceVariantKey of sourceVariantKeys) {
    if (!variantMap.has(sourceVariantKey)) {
      throw new Error(
        `Unable to resolve ${fixture.cardCode} variant source_variant_key=${sourceVariantKey}.`
      );
    }
  }

  return variantMap;
}

function buildRawObservationInsert(
  fixture: ManualFixture,
  testCase: ManualFixtureCase,
  variantMap: Map<string, VariantRow>
): PriceIngestionRawPriceObservationInsert {
  const matchedVariantId = testCase.source_variant_key
    ? variantMap.get(testCase.source_variant_key)?.id ?? null
    : null;
  const priceJpy = parseFixturePriceJpy(
    testCase.raw_price_text,
    testCase.availability_status
  );
  const canonicalEligible =
    testCase.expected.should_publish_canonical &&
    testCase.availability_status === "available" &&
    matchedVariantId !== null;

  return {
    source: fixture.source,
    source_listing_id: testCase.source_listing_id,
    source_url: testCase.source_url,
    observed_at: fixture.observedAt,
    parser_version: fixture.parserVersion,
    normalized_card_code: fixture.cardCode,
    source_variant_key: testCase.source_variant_key,
    raw_title: testCase.raw_title,
    raw_condition: testCase.raw_condition,
    normalized_condition: testCase.expected.condition,
    raw_price_text: testCase.raw_price_text,
    price_jpy: priceJpy,
    availability_status: testCase.availability_status,
    listing_kind: testCase.expected.listing_kind,
    normalized_parse_output: {
      fixture_case_id: testCase.id,
      capture_method: fixture.captureMethod,
      condition_bucket: testCase.expected.condition,
      canonical_eligible: canonicalEligible,
      expected_publishable: testCase.expected.should_publish_canonical,
      excluded_reason: testCase.expected.excluded_reason ?? null,
      source_variant_key: testCase.source_variant_key
    },
    raw_text_snapshot: testCase.raw_text_snapshot,
    snapshot_ref: testCase.snapshot_ref,
    excluded_reason: testCase.expected.excluded_reason ?? null,
    match_confidence: testCase.expected.match_confidence,
    matched_variant_id: matchedVariantId
  };
}

function toCanonicalObservation(
  row: PriceIngestionRawPriceObservationRow
): PriceIngestionRawObservation & { id: string; sourceVariantKey: string | null } {
  return {
    id: row.id,
    source: row.source,
    sourceListingId: row.source_listing_id,
    sourceUrl: row.source_url,
    observedAt: row.observed_at,
    parserVersion: PRICE_INGESTION_PARSER_VERSION,
    normalizedCardCode: row.normalized_card_code,
    rawTitle: row.raw_title ?? "",
    rawCondition: row.raw_condition,
    rawPriceText: row.raw_price_text,
    priceJpy: row.price_jpy,
    availabilityStatus: row.availability_status,
    listingKind: row.listing_kind,
    conditionScale: row.normalized_condition,
    rawTextSnapshot: row.raw_text_snapshot,
    snapshotRef: row.snapshot_ref,
    excludedReason: row.excluded_reason,
    matchConfidence: row.match_confidence,
    matchedVariantId: row.matched_variant_id,
    sourceVariantKey: row.source_variant_key
  };
}

function toCanonicalInsert(
  fixture: ManualFixture,
  candidate: ReturnType<typeof deriveCanonicalPriceCandidates>[number]
): PriceIngestionCanonicalPricePointInsert {
  return {
    variant_id: candidate.variantId,
    source: candidate.source,
    source_day_jst: candidate.sourceDayJst,
    pricing_basis: candidate.basis,
    condition_scale: candidate.conditionScale,
    price_jpy: candidate.priceJpy,
    observed_at: candidate.observedAt,
    evidence_kind: "raw_observation",
    raw_observation_id: candidate.rawObservationId,
    evidence_ref: candidate.observation.snapshotRef,
    selection_rank: candidate.selectionRank,
    selection_reason: candidate.selectionReason,
    derivation_version: fixture.parserVersion
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  requireServiceRoleCredentials();

  const fixture = await loadManualFixture(options.fixturePath);

  if (!fixture.cases.some((testCase) => testCase.expected.should_insert_raw)) {
    throw new Error("Fixture has no raw observations to insert.");
  }

  const supabase = getPriceIngestionAdminSupabaseClient();

  await verifyCardRushCompliance(supabase);

  const variantMap = await loadVariantMap(fixture, supabase);
  const rawObservationInserts = fixture.cases
    .filter((testCase) => testCase.expected.should_insert_raw)
    .map((testCase) => buildRawObservationInsert(fixture, testCase, variantMap));

  const rawObservations = await insertRawPriceObservations(
    rawObservationInserts,
    supabase
  );
  const canonicalCandidates = deriveCanonicalPriceCandidates({
    basis: PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
    observations: rawObservations.map(toCanonicalObservation)
  });

  const expectedFixtureCandidates = deriveFixtureCanonicalCandidates(fixture);

  if (expectedFixtureCandidates.length !== fixture.expectedCanonicalSelections.length) {
    throw new Error(
      [
        "Fixture expectedCanonicalSelections length does not match derived candidate count.",
        `expected=${fixture.expectedCanonicalSelections.length}`,
        `derived=${expectedFixtureCandidates.length}`
      ].join(" ")
    );
  }

  for (const expectedSelection of fixture.expectedCanonicalSelections) {
    const matchingCandidate = expectedFixtureCandidates.find(
      (candidate) =>
        candidate.basis === expectedSelection.pricing_basis &&
        candidate.sourceDayJst === expectedSelection.source_day_jst &&
        candidate.observation.sourceListingId === expectedSelection.source_listing_id &&
        candidate.observation.sourceVariantKey === expectedSelection.source_variant_key &&
        candidate.conditionScale === expectedSelection.condition
    );

    if (!matchingCandidate) {
      throw new Error(
        [
          "Fixture expectedCanonicalSelections does not match derived canonical candidates.",
          `missing source_listing_id=${expectedSelection.source_listing_id}`,
          `source_variant_key=${expectedSelection.source_variant_key}`,
          `source_day_jst=${expectedSelection.source_day_jst}`
        ].join(" ")
      );
    }
  }

  const canonicalPoints = await upsertCanonicalPricePoints(
    canonicalCandidates.map((candidate) => toCanonicalInsert(fixture, candidate)),
    supabase
  );
  const publishedRows = options.publish
    ? await publishCanonicalPricePointsToPriceHistory(canonicalPoints, { supabase })
    : [];

  console.log(`Loaded fixture: ${options.fixturePath}`);
  console.log(`Inserted raw observations: ${rawObservations.length}`);
  console.log(`Upserted canonical points: ${canonicalPoints.length}`);
  console.log(
    options.publish
      ? `Published price_history rows: ${publishedRows.length}`
      : "Skipped price_history publishing; rerun with --publish to publish."
  );
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Card Rush fixture ingestion failed: ${message}`);
  process.exit(1);
});
