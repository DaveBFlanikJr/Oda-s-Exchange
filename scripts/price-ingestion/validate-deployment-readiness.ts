import { readFile } from "node:fs/promises";
import path from "node:path";

import { PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS } from "@/lib/pricing/ingestion/constants";
import {
  countPublishableFixtureCases,
  defaultManualCoverageManifestPath,
  deriveFixtureCanonicalCandidates,
  groupPublishableFixtureCases,
  loadManualCoverageManifest,
  loadManualFixture,
  repoRoot,
  type ManualCoverageManifestFixture,
  type ManualFixture
} from "@/scripts/price-ingestion/manual-publish-fixtures";

type Issue = {
  area: string;
  message: string;
};

const workflowPath = path.join(repoRoot, ".github", "workflows", "scraper.yml");
const packageJsonPath = path.join(repoRoot, "package.json");
const dbSmokePath = path.join(repoRoot, "tests", "db", "card-smoke.sql");
const dbSmokeRunnerPath = path.join(repoRoot, "tests", "db", "run-card-smoke.sh");
const migrationPaths = {
  sourceCompliance: path.join(
    repoRoot,
    "supabase",
    "migrations",
    "202604060005_seed_source_compliance_records.sql"
  ),
  canonicalPricePoints: path.join(
    repoRoot,
    "supabase",
    "migrations",
    "202604130001_canonical_price_points.sql"
  ),
  publishMetadata: path.join(
    repoRoot,
    "supabase",
    "migrations",
    "202604140001_add_price_history_publish_metadata.sql"
  )
};

function addIssue(issues: Issue[], area: string, message: string) {
  issues.push({ area, message });
}

function requireMatch(
  issues: Issue[],
  area: string,
  content: string,
  pattern: RegExp,
  message: string
) {
  if (!pattern.test(content)) {
    addIssue(issues, area, message);
  }
}

function forbidMatch(
  issues: Issue[],
  area: string,
  content: string,
  pattern: RegExp,
  message: string
) {
  if (pattern.test(content)) {
    addIssue(issues, area, message);
  }
}

function getWorkflowTriggerEvents(workflow: string) {
  const lines = workflow.split(/\r?\n/);
  const onLineIndex = lines.findIndex((line) => line.trim() === "on:");

  if (onLineIndex === -1) {
    const inlineOn = lines.find((line) => line.startsWith("on:"));
    const inlineValue = inlineOn?.slice("on:".length).trim();

    if (!inlineValue) {
      return [];
    }

    if (inlineValue.startsWith("[") && inlineValue.endsWith("]")) {
      return inlineValue
        .slice(1, -1)
        .split(",")
        .map((eventName) => eventName.trim())
        .filter(Boolean);
    }

    return [inlineValue];
  }

  const events: string[] = [];

  for (const line of lines.slice(onLineIndex + 1)) {
    if (/^\S/.test(line) && line.trim().length > 0) {
      break;
    }

    const eventMatch = line.match(/^  ([A-Za-z_][A-Za-z0-9_-]*):\s*$/);
    const listEventMatch = line.match(/^  - ([A-Za-z_][A-Za-z0-9_-]*)\s*$/);

    if (eventMatch) {
      events.push(eventMatch[1]);
    } else if (listEventMatch) {
      events.push(listEventMatch[1]);
    }
  }

  return events;
}

async function validateWorkflow(issues: Issue[]) {
  const workflow = await readFile(workflowPath, "utf8");
  const triggerEvents = getWorkflowTriggerEvents(workflow);

  requireMatch(
    issues,
    "workflow",
    workflow,
    /^\s*workflow_dispatch:\s*$/m,
    "scraper workflow should remain manually triggerable for readiness checks"
  );
  if (triggerEvents.length !== 1 || triggerEvents[0] !== "workflow_dispatch") {
    addIssue(
      issues,
      "workflow",
      `scraper workflow should be manual-only; found triggers: ${triggerEvents.join(", ") || "none"}`
    );
  }
  forbidMatch(
    issues,
    "workflow",
    workflow,
    /^\s*schedule:\s*$/m,
    "scraper workflow must not have a scheduled trigger while Card Rush is manual-fixture only"
  );
  forbidMatch(
    issues,
    "workflow",
    workflow,
    /\bpnpm\s+scrape\b/,
    "scraper workflow must not invoke pnpm scrape"
  );
  forbidMatch(
    issues,
    "workflow",
    workflow,
    /playwright\s+install|Install Playwright browsers/i,
    "readiness workflow must not install Playwright browsers because it must not scrape"
  );
  forbidMatch(
    issues,
    "workflow",
    workflow,
    /SUPABASE_SERVICE_ROLE_KEY|SCRAPER_MANUAL_RUN_TOKEN/,
    "readiness workflow should not need write credentials or scraper run tokens"
  );
  requireMatch(
    issues,
    "workflow",
    workflow,
    /\bpnpm\s+test:deployment-readiness\b/,
    "readiness workflow should run deployment-readiness tests"
  );
  requireMatch(
    issues,
    "workflow",
    workflow,
    /\bpnpm\s+test:price-ingestion\b/,
    "readiness workflow should run price-ingestion fixture tests"
  );
  requireMatch(
    issues,
    "workflow",
    workflow,
    /\bpnpm\s+test:pricing-read\b/,
    "readiness workflow should run backend pricing-read integration tests"
  );
  requireMatch(
    issues,
    "workflow",
    workflow,
    /\bpnpm\s+migrations:verify\b/,
    "readiness workflow should run the migration verification smoke test"
  );
  requireMatch(
    issues,
    "workflow",
    workflow,
    /DATABASE_URL:\s*\$\{\{\s*secrets\.DATABASE_URL\s*\}\}/,
    "migration verification step should receive DATABASE_URL from GitHub secrets"
  );
  requireMatch(
    issues,
    "workflow",
    workflow,
    /\bpnpm\s+typecheck\b/,
    "readiness workflow should run TypeScript typecheck"
  );
}

async function validatePackageScripts(issues: Issue[]) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };
  const scripts = packageJson.scripts ?? {};

  if (
    scripts["test:deployment-readiness"] !==
    "node --import tsx scripts/price-ingestion/validate-deployment-readiness.ts"
  ) {
    addIssue(
      issues,
      "package.json",
      "package.json should expose test:deployment-readiness for CI and local verification"
    );
  }

  if (
    !scripts["ingest:card-rush-fixture"]?.includes(
      "scripts/price-ingestion/ingest-card-rush-fixture.ts"
    )
  ) {
    addIssue(
      issues,
      "package.json",
      "package.json should expose ingest:card-rush-fixture for the manual fixture path"
    );
  }

  if (!scripts["migrations:verify"]?.includes("tests/db/run-card-smoke.sh")) {
    addIssue(
      issues,
      "package.json",
      "package.json should expose migrations:verify for deployment migration verification"
    );
  }

  if (
    !scripts["test:pricing-read"]?.includes(
      "tests/pricing-read/backend.test.ts"
    )
  ) {
    addIssue(
      issues,
      "package.json",
      "package.json should expose test:pricing-read for backend pricing-read integration coverage"
    );
  }

  if (
    !scripts["audit:pricing-lineage"]?.includes(
      "scripts/price-ingestion/lineage-coverage-audit.ts"
    )
  ) {
    addIssue(
      issues,
      "package.json",
      "package.json should expose audit:pricing-lineage for canonical lineage coverage checks before metadata cutover"
    );
  }
}

async function validateMigrationsAndSmokeSql(issues: Issue[]) {
  const sourceCompliance = await readFile(migrationPaths.sourceCompliance, "utf8");
  const canonicalPricePoints = await readFile(migrationPaths.canonicalPricePoints, "utf8");
  const publishMetadata = await readFile(migrationPaths.publishMetadata, "utf8");
  const dbSmoke = await readFile(dbSmokePath, "utf8");
  const dbSmokeRunner = await readFile(dbSmokeRunnerPath, "utf8");

  requireMatch(
    issues,
    "migrations",
    sourceCompliance,
    /'card_rush'[\s\S]*'https:\/\/cardrush\.media\/data_policy'[\s\S]*'restricted'[\s\S]*'manual_fixture'[\s\S]*false/,
    "Card Rush migration seed should keep Card Rush restricted, manual_fixture only, and unscheduled"
  );
  requireMatch(
    issues,
    "migrations",
    canonicalPricePoints,
    /evidence_kind = 'raw_observation'[\s\S]*raw_observation_id is not null[\s\S]*evidence_kind = 'authorized_feed'[\s\S]*evidence_ref is not null/,
    "canonical_price_points migration should require raw lineage or authorized-feed evidence"
  );
  requireMatch(
    issues,
    "migrations",
    publishMetadata,
    /idx_price_history_published_canonical_unique[\s\S]*variant_id[\s\S]*source[\s\S]*source_day_jst[\s\S]*pricing_basis/,
    "price_history publish metadata migration should keep canonical publishing idempotent"
  );
  requireMatch(
    issues,
    "db smoke",
    dbSmoke,
    /source_compliance_records[\s\S]*card_rush[\s\S]*restricted[\s\S]*manual_fixture[\s\S]*scheduled_collection_enabled/,
    "DB smoke should verify Card Rush compliance state before fixture ingestion or publishing"
  );
  requireMatch(
    issues,
    "db smoke",
    dbSmoke,
    /db-smoke-eb02-061-available-near-mint[\s\S]*db-smoke-eb02-061-available-mint/,
    "DB smoke should include same-day near-mint and mint raw observations for condition-aware publish proof"
  );
  requireMatch(
    issues,
    "db smoke",
    dbSmoke,
    /condition-aware best-condition update from competing raw observations/,
    "DB smoke should prove a same-day condition-aware canonical update before publishing to price_history"
  );
  requireMatch(
    issues,
    "db smoke",
    dbSmokeRunner,
    /if \[\[ -f "\$\{ENV_FILE\}" \]\]/,
    "DB smoke runner should load .env.test.local only when present so CI can use DATABASE_URL from the environment"
  );
  forbidMatch(
    issues,
    "db smoke",
    dbSmokeRunner,
    /Missing \$\{ENV_FILE\}/,
    "DB smoke runner must not require local-only .env.test.local when DATABASE_URL is already provided"
  );
}

function validateFixtureCaseBasics(
  issues: Issue[],
  fixture: ManualFixture,
  fixtureLabel: string,
  options: {
    requireBroadExclusions: boolean;
  }
) {
  const ids = new Set<string>();
  const listingIds = new Set<string>();
  const requiredExclusions = new Set([
    "availability_status",
    "damaged_condition",
    "deck_product",
    "ambiguous_variant"
  ]);
  const coveredExclusions = new Set<string>();

  if (!/^[A-Z]{1,3}([0-9]{2})?-[0-9]{3}$/.test(fixture.cardCode)) {
    addIssue(issues, fixtureLabel, "fixture cardCode must be normalized");
  }

  if (Number.isNaN(Date.parse(fixture.observedAt))) {
    addIssue(issues, fixtureLabel, "fixture observedAt must be a valid timestamp");
  }

  if (!fixture.parserVersion.startsWith("manual-card-rush-fixture.")) {
    addIssue(
      issues,
      fixtureLabel,
      "fixture parserVersion should identify manual fixture ingestion"
    );
  }

  if (fixture.cases.length < 3) {
    addIssue(issues, fixtureLabel, "fixture should cover multiple curated cases");
  }

  for (const testCase of fixture.cases) {
    if (ids.has(testCase.id)) {
      addIssue(issues, fixtureLabel, `duplicate case id: ${testCase.id}`);
    }
    ids.add(testCase.id);

    if (listingIds.has(testCase.source_listing_id)) {
      addIssue(
        issues,
        fixtureLabel,
        `duplicate source_listing_id: ${testCase.source_listing_id}`
      );
    }
    listingIds.add(testCase.source_listing_id);

    if (!testCase.source_url.startsWith("https://www.cardrush-op.jp/")) {
      addIssue(
        issues,
        fixtureLabel,
        `${testCase.id} should preserve the Card Rush source URL without fetching it`
      );
    }

    if (!testCase.raw_text_snapshot || testCase.raw_text_snapshot.length > 8192) {
      addIssue(
        issues,
        fixtureLabel,
        `${testCase.id} should include a bounded raw_text_snapshot`
      );
    }

    if (!testCase.snapshot_ref.startsWith("manual-fixtures/card-rush/")) {
      addIssue(
        issues,
        fixtureLabel,
        `${testCase.id} snapshot_ref should point at durable manual fixture evidence`
      );
    }

    if (testCase.expected.normalized_card_code !== fixture.cardCode) {
      addIssue(
        issues,
        fixtureLabel,
        `${testCase.id} expected normalized_card_code should match fixture cardCode`
      );
    }

    if (testCase.expected.should_publish_canonical) {
      if (testCase.availability_status !== "available") {
        addIssue(
          issues,
          fixtureLabel,
          `${testCase.id} cannot publish unless availability_status is available`
        );
      }

      if (testCase.expected.listing_kind !== "single_card") {
        addIssue(
          issues,
          fixtureLabel,
          `${testCase.id} cannot publish unless listing_kind is single_card`
        );
      }

      if (["damaged", "graded"].includes(testCase.expected.condition)) {
        addIssue(
          issues,
          fixtureLabel,
          `${testCase.id} cannot publish damaged or graded conditions`
        );
      }

      if (!testCase.source_variant_key) {
        addIssue(
          issues,
          fixtureLabel,
          `${testCase.id} must include source_variant_key before canonical publish`
        );
      }
    } else if (testCase.expected.excluded_reason) {
      coveredExclusions.add(testCase.expected.excluded_reason);
    }
  }

  if (options.requireBroadExclusions) {
    for (const exclusion of requiredExclusions) {
      if (!coveredExclusions.has(exclusion)) {
        addIssue(
          issues,
          fixtureLabel,
          `fixture should cover excluded_reason=${exclusion}`
        );
      }
    }
  }
}

function validateFixtureCanonicalExpectations(
  issues: Issue[],
  fixture: ManualFixture,
  fixtureLabel: string
) {
  const derivedCandidates = deriveFixtureCanonicalCandidates(fixture);

  if (fixture.expectedCanonicalSelections.length !== derivedCandidates.length) {
    addIssue(
      issues,
      fixtureLabel,
      [
        "expectedCanonicalSelections length should match derived candidate count",
        `expected=${fixture.expectedCanonicalSelections.length}`,
        `derived=${derivedCandidates.length}`
      ].join(" ")
    );
  }

  for (const expectedSelection of fixture.expectedCanonicalSelections) {
    if (
      expectedSelection.pricing_basis !==
      PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS
    ) {
      addIssue(
        issues,
        fixtureLabel,
        "expected canonical selections must target the default canonical pricing basis"
      );
    }

    const matchingCandidate = derivedCandidates.find(
      (candidate) =>
        candidate.basis === expectedSelection.pricing_basis &&
        candidate.sourceDayJst === expectedSelection.source_day_jst &&
        candidate.observation.sourceListingId === expectedSelection.source_listing_id &&
        candidate.observation.sourceVariantKey === expectedSelection.source_variant_key
    );

    if (!matchingCandidate) {
      addIssue(
        issues,
        fixtureLabel,
        `missing derived canonical selection for ${expectedSelection.source_listing_id}`
      );
      continue;
    }

    if (matchingCandidate.conditionScale !== expectedSelection.condition) {
      addIssue(
        issues,
        fixtureLabel,
        [
          `expected canonical selection ${expectedSelection.source_listing_id}`,
          `should use condition=${expectedSelection.condition}`,
          `actual=${matchingCandidate.conditionScale}`
        ].join(" ")
      );
    }
  }
}

function validateCoverageEntryAgainstFixture(
  issues: Issue[],
  entry: ManualCoverageManifestFixture,
  fixture: ManualFixture,
  fixtureLabel: string
) {
  if (entry.coverage.cardCode !== fixture.cardCode) {
    addIssue(
      issues,
      fixtureLabel,
      `coverage cardCode should be ${fixture.cardCode}, found ${entry.coverage.cardCode}`
    );
  }

  const publishableCount = countPublishableFixtureCases(fixture);

  if (
    entry.coverage.expectedOutcome === "published_history" &&
    fixture.expectedCanonicalSelections.length === 0
  ) {
    addIssue(
      issues,
      fixtureLabel,
      "published_history fixtures must define at least one expected canonical selection"
    );
  }

  if (entry.coverage.expectedOutcome === "no_qualifying_rows" && publishableCount > 0) {
    addIssue(
      issues,
      fixtureLabel,
      "no_qualifying_rows fixtures must not include publishable canonical cases"
    );
  }

  if (
    entry.coverage.expectedOutcome === "published_history" &&
    entry.coverage.readerSurfaces.length === 0
  ) {
    addIssue(
      issues,
      fixtureLabel,
      "published_history fixtures should name at least one reader surface to verify"
    );
  }
}

async function validateManualCoverageFixtures(issues: Issue[]) {
  const manifest = await loadManualCoverageManifest(defaultManualCoverageManifestPath);

  if (
    manifest.pricingBasis !== PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS
  ) {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest must target the default canonical pricing basis"
    );
  }

  if (manifest.reconciliation.strategy !== "constrained_publish_window") {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest must declare constrained_publish_window reconciliation"
    );
  }

  if (manifest.reconciliation.assumptions.length === 0) {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest must document reconciliation assumptions"
    );
  }

  if (manifest.fixtures.length < 4) {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest should include multiple curated fixtures, not a single card-day"
    );
  }

  const uniqueCards = new Set<string>();
  const publishedCards = new Set<string>();
  const cardsWithNoQualifyingRows = new Set<string>();
  const publishedDaysByCard = new Map<string, Set<string>>();
  let hasSameDayCompetitionProof = false;
  let hasAllReaderSurfaces = false;

  for (const entry of manifest.fixtures) {
    const fixture = await loadManualFixture(entry.path);
    const fixtureLabel = `manual fixture ${entry.path}`;
    uniqueCards.add(fixture.cardCode);

    const requireBroadExclusions =
      entry.path === "tests/fixtures/price-ingestion/card-rush-manual-ingestion-eb02-061.json";
    validateFixtureCaseBasics(issues, fixture, fixtureLabel, {
      requireBroadExclusions
    });
    validateFixtureCanonicalExpectations(issues, fixture, fixtureLabel);
    validateCoverageEntryAgainstFixture(issues, entry, fixture, fixtureLabel);

    if (entry.coverage.expectedOutcome === "published_history") {
      publishedCards.add(fixture.cardCode);
    } else {
      cardsWithNoQualifyingRows.add(fixture.cardCode);
    }

    for (const expectedSelection of fixture.expectedCanonicalSelections) {
      const days = publishedDaysByCard.get(fixture.cardCode) ?? new Set<string>();
      days.add(expectedSelection.source_day_jst);
      publishedDaysByCard.set(fixture.cardCode, days);
    }

    for (const groupedCases of groupPublishableFixtureCases(fixture).values()) {
      if (groupedCases.length >= 2) {
        hasSameDayCompetitionProof = true;
      }
    }

    if (
      entry.coverage.expectedOutcome === "published_history" &&
      entry.coverage.readerSurfaces.includes("catalog") &&
      entry.coverage.readerSurfaces.includes("card_detail") &&
      entry.coverage.readerSurfaces.includes("api_prices")
    ) {
      hasAllReaderSurfaces = true;
    }
  }

  if (publishedCards.size < 2) {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest should publish canonical rows for multiple cards"
    );
  }

  if (uniqueCards.size < 3) {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest should cover at least several distinct cards"
    );
  }

  if (cardsWithNoQualifyingRows.size < 1) {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest should include at least one no_qualifying_rows card"
    );
  }

  const hasMultiDayPublishedHistory = [...publishedDaysByCard.values()].some(
    (days) => days.size >= 2
  );

  if (!hasMultiDayPublishedHistory) {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest should include at least one card with multi-day publish history"
    );
  }

  if (!hasSameDayCompetitionProof) {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest should preserve at least one same-day competing eligible condition proof"
    );
  }

  if (!hasAllReaderSurfaces) {
    addIssue(
      issues,
      "manual coverage manifest",
      "coverage manifest should include at least one published card verified across catalog, card detail, and /api/prices"
    );
  }
}

async function main() {
  const issues: Issue[] = [];

  await validateWorkflow(issues);
  await validatePackageScripts(issues);
  await validateMigrationsAndSmokeSql(issues);
  await validateManualCoverageFixtures(issues);

  if (issues.length === 0) {
    console.log("Deployment readiness checks passed.");
    return;
  }

  console.error(
    `Found ${issues.length} deployment readiness issue${issues.length === 1 ? "" : "s"}:`
  );
  for (const issue of issues) {
    console.error(`- ${issue.area}: ${issue.message}`);
  }
  process.exit(1);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Deployment readiness validation failed: ${message}`);
  process.exit(1);
});
