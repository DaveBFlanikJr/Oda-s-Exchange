import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type Issue = {
  area: string;
  message: string;
};

type ManualFixtureCase = {
  id: string;
  source_listing_id: string;
  source_url: string;
  source_variant_key: string | null;
  raw_title: string;
  raw_condition: string | null;
  raw_price_text: string | null;
  availability_status: "available" | "sold_out" | "error";
  raw_text_snapshot: string;
  snapshot_ref: string;
  expected: {
    normalized_card_code: string;
    listing_kind: string;
    condition: string;
    match_confidence: string;
    excluded_reason?: string;
    should_insert_raw: boolean;
    should_publish_canonical: boolean;
  };
};

type ManualFixture = {
  schema: string;
  description: string;
  source: string;
  sourcePolicyUrl: string;
  captureMethod: string;
  cardCode: string;
  observedAt: string;
  parserVersion: string;
  cases: ManualFixtureCase[];
};

type ExpectedManualFixtureCase = {
  sourceVariantKey: string | null;
  availabilityStatus: ManualFixtureCase["availability_status"];
  listingKind: string;
  condition: string;
  matchConfidence: string;
  excludedReason?: string;
  shouldInsertRaw: boolean;
  shouldPublishCanonical: boolean;
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "scraper.yml");
const packageJsonPath = path.join(repoRoot, "package.json");
const dbSmokePath = path.join(repoRoot, "tests", "db", "card-smoke.sql");
const dbSmokeRunnerPath = path.join(repoRoot, "tests", "db", "run-card-smoke.sh");
const manualFixturePath = path.join(
  repoRoot,
  "tests",
  "fixtures",
  "price-ingestion",
  "card-rush-manual-ingestion-eb02-061.json"
);
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

const expectedManualFixtureCases = new Map<string, ExpectedManualFixtureCase>([
  [
    "card_rush_manual_standard_near_mint",
    {
      sourceVariantKey: "STD",
      availabilityStatus: "available",
      listingKind: "single_card",
      condition: "near_mint",
      matchConfidence: "high",
      shouldInsertRaw: true,
      shouldPublishCanonical: true
    }
  ],
  [
    "card_rush_manual_sold_out",
    {
      sourceVariantKey: "STD",
      availabilityStatus: "sold_out",
      listingKind: "single_card",
      condition: "mint",
      matchConfidence: "high",
      excludedReason: "availability_status",
      shouldInsertRaw: true,
      shouldPublishCanonical: false
    }
  ],
  [
    "card_rush_manual_damaged",
    {
      sourceVariantKey: "STD",
      availabilityStatus: "available",
      listingKind: "single_card",
      condition: "damaged",
      matchConfidence: "high",
      excludedReason: "damaged_condition",
      shouldInsertRaw: true,
      shouldPublishCanonical: false
    }
  ],
  [
    "card_rush_manual_deck_noise",
    {
      sourceVariantKey: null,
      availabilityStatus: "available",
      listingKind: "deck_product",
      condition: "unknown",
      matchConfidence: "excluded",
      excludedReason: "deck_product",
      shouldInsertRaw: true,
      shouldPublishCanonical: false
    }
  ],
  [
    "card_rush_manual_ambiguous_variant",
    {
      sourceVariantKey: null,
      availabilityStatus: "available",
      listingKind: "single_card",
      condition: "mint",
      matchConfidence: "excluded",
      excludedReason: "ambiguous_variant",
      shouldInsertRaw: true,
      shouldPublishCanonical: false
    }
  ]
]);

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

  if (scripts["test:deployment-readiness"] !== "node --import tsx scripts/price-ingestion/validate-deployment-readiness.ts") {
    addIssue(
      issues,
      "package.json",
      "package.json should expose test:deployment-readiness for CI and local verification"
    );
  }

  if (!scripts["ingest:card-rush-fixture"]?.includes("scripts/price-ingestion/ingest-card-rush-fixture.ts")) {
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

async function validateManualFixture(issues: Issue[]) {
  const fixture = JSON.parse(await readFile(manualFixturePath, "utf8")) as ManualFixture;
  const ids = new Set<string>();
  const listingIds = new Set<string>();
  const requiredExclusions = new Set([
    "availability_status",
    "damaged_condition",
    "deck_product",
    "ambiguous_variant"
  ]);
  const coveredExclusions = new Set<string>();

  if (fixture.schema !== "card-rush-manual-ingestion-fixture/v1") {
    addIssue(issues, "manual fixture", "manual fixture schema is not recognized");
  }

  if (fixture.source !== "card_rush") {
    addIssue(issues, "manual fixture", "manual fixture source must be card_rush");
  }

  if (fixture.sourcePolicyUrl !== "https://cardrush.media/data_policy") {
    addIssue(issues, "manual fixture", "manual fixture must record the Card Rush policy URL");
  }

  if (fixture.captureMethod !== "manual_fixture") {
    addIssue(issues, "manual fixture", "manual fixture captureMethod must be manual_fixture");
  }

  if (!/^[A-Z]{1,3}([0-9]{2})?-[0-9]{3}$/.test(fixture.cardCode)) {
    addIssue(issues, "manual fixture", "manual fixture cardCode must be normalized");
  }

  if (Number.isNaN(Date.parse(fixture.observedAt))) {
    addIssue(issues, "manual fixture", "manual fixture observedAt must be a valid timestamp");
  }

  if (!fixture.parserVersion.startsWith("manual-card-rush-fixture.")) {
    addIssue(issues, "manual fixture", "manual fixture parserVersion should identify manual fixture ingestion");
  }

  if (fixture.cases.length < 5) {
    addIssue(issues, "manual fixture", "manual fixture should cover publishable and excluded cases");
  }

  if (fixture.cases.length !== expectedManualFixtureCases.size) {
    addIssue(
      issues,
      "manual fixture",
      `manual fixture should contain exactly ${expectedManualFixtureCases.size} curated cases`
    );
  }

  for (const testCase of fixture.cases) {
    const expectedCase = expectedManualFixtureCases.get(testCase.id);

    if (!expectedCase) {
      addIssue(issues, "manual fixture", `unexpected manual fixture case: ${testCase.id}`);
    }

    if (ids.has(testCase.id)) {
      addIssue(issues, "manual fixture", `duplicate case id: ${testCase.id}`);
    }
    ids.add(testCase.id);

    if (listingIds.has(testCase.source_listing_id)) {
      addIssue(
        issues,
        "manual fixture",
        `duplicate source_listing_id: ${testCase.source_listing_id}`
      );
    }
    listingIds.add(testCase.source_listing_id);

    if (!testCase.source_url.startsWith("https://www.cardrush-op.jp/")) {
      addIssue(
        issues,
        "manual fixture",
        `${testCase.id} should preserve the Card Rush source URL without fetching it`
      );
    }

    if (!testCase.raw_text_snapshot || testCase.raw_text_snapshot.length > 8192) {
      addIssue(
        issues,
        "manual fixture",
        `${testCase.id} should include a bounded raw_text_snapshot`
      );
    }

    if (!testCase.snapshot_ref.startsWith("manual-fixtures/card-rush/")) {
      addIssue(
        issues,
        "manual fixture",
        `${testCase.id} snapshot_ref should point at durable manual fixture evidence`
      );
    }

    if (testCase.expected.normalized_card_code !== fixture.cardCode) {
      addIssue(
        issues,
        "manual fixture",
        `${testCase.id} expected normalized_card_code should match fixture cardCode`
      );
    }

    if (expectedCase) {
      if (testCase.source_variant_key !== expectedCase.sourceVariantKey) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} source_variant_key should be ${expectedCase.sourceVariantKey ?? "null"}`
        );
      }

      if (testCase.availability_status !== expectedCase.availabilityStatus) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} availability_status should be ${expectedCase.availabilityStatus}`
        );
      }

      if (testCase.expected.listing_kind !== expectedCase.listingKind) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} listing_kind should be ${expectedCase.listingKind}`
        );
      }

      if (testCase.expected.condition !== expectedCase.condition) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} condition should be ${expectedCase.condition}`
        );
      }

      if (testCase.expected.match_confidence !== expectedCase.matchConfidence) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} match_confidence should be ${expectedCase.matchConfidence}`
        );
      }

      if (testCase.expected.excluded_reason !== expectedCase.excludedReason) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} excluded_reason should be ${expectedCase.excludedReason ?? "unset"}`
        );
      }

      if (testCase.expected.should_insert_raw !== expectedCase.shouldInsertRaw) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} should_insert_raw should be ${expectedCase.shouldInsertRaw}`
        );
      }

      if (testCase.expected.should_publish_canonical !== expectedCase.shouldPublishCanonical) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} should_publish_canonical should be ${expectedCase.shouldPublishCanonical}`
        );
      }
    }

    if (testCase.expected.should_publish_canonical) {
      if (testCase.availability_status !== "available") {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} cannot publish unless availability_status is available`
        );
      }

      if (testCase.expected.listing_kind !== "single_card") {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} cannot publish unless listing_kind is single_card`
        );
      }

      if (["damaged", "graded"].includes(testCase.expected.condition)) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} cannot publish damaged or graded conditions`
        );
      }

      if (!testCase.source_variant_key) {
        addIssue(
          issues,
          "manual fixture",
          `${testCase.id} must include source_variant_key before canonical publish`
        );
      }
    } else if (testCase.expected.excluded_reason) {
      coveredExclusions.add(testCase.expected.excluded_reason);
    }
  }

  for (const expectedCaseId of expectedManualFixtureCases.keys()) {
    if (!ids.has(expectedCaseId)) {
      addIssue(issues, "manual fixture", `missing manual fixture case: ${expectedCaseId}`);
    }
  }

  for (const exclusion of requiredExclusions) {
    if (!coveredExclusions.has(exclusion)) {
      addIssue(
        issues,
        "manual fixture",
        `manual fixture should cover excluded_reason=${exclusion}`
      );
    }
  }
}

async function main() {
  const issues: Issue[] = [];

  await validateWorkflow(issues);
  await validatePackageScripts(issues);
  await validateMigrationsAndSmokeSql(issues);
  await validateManualFixture(issues);

  if (issues.length === 0) {
    console.log("Deployment readiness checks passed.");
    return;
  }

  console.error(`Found ${issues.length} deployment readiness issue${issues.length === 1 ? "" : "s"}:`);
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
