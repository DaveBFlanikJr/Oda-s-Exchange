import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS } from "@/lib/pricing/ingestion/constants";
import { getRecentJstWindowStartIso } from "@/lib/card-detail/time";
import {
  defaultManualCoverageManifestPath,
  deriveFixtureCanonicalCandidates,
  getManualPublishDayJst,
  loadManualCoverageManifest,
  loadManualFixture
} from "@/scripts/price-ingestion/manual-publish-fixtures";

type SupabaseCredentials = {
  url: string;
  key: string;
  keyLabel: "service_role" | "anon";
};

type AuditOptions = {
  cardCode: string | null;
  manifestPath: string | null;
  windowDays: number | null;
  sampleLimit: number;
};

type VariantRow = {
  id: string;
  card_id: string;
  source_variant_key: string;
  variant_type: string;
};

type PriceHistoryAuditRow = {
  id: string;
  variant_id: string;
  source: string;
  price_jpy: number | null;
  recorded_at: string;
  pricing_basis: string | null;
  source_day_jst: string | null;
  canonical_price_point_id: string | null;
};

type CanonicalPricePointAuditRow = {
  id: string;
  variant_id: string;
  source: string;
  source_day_jst: string;
  pricing_basis: string;
  condition_scale: string;
  price_jpy: number | null;
};

type ExpectedManifestRow = {
  label: string;
  cardCode: string;
  sourceVariantKey: string;
  variantId: string;
  sourceDayJst: string;
  pricingBasis: string;
  conditionScale: string;
  priceJpy: number;
};

type ExpectedManifestEmptyKey = {
  label: string;
  cardCode: string;
  sourceVariantKey: string;
  variantId: string;
  sourceDayJst: string;
  pricingBasis: string;
};

type AuditSupabaseClient = SupabaseClient;

function parseArgs(argv: string[]): AuditOptions {
  let cardCode: string | null = null;
  let manifestPath: string | null = null;
  let windowDays: number | null = null;
  let sampleLimit = 10;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--card-code" || arg === "-c") {
      const value = argv[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --card-code.");
      }

      cardCode = value.trim().toUpperCase();
      index += 1;
      continue;
    }

    if (arg.startsWith("--card-code=")) {
      cardCode = arg.slice("--card-code=".length).trim().toUpperCase();
      continue;
    }

    if (arg === "--window-days" || arg === "-w") {
      const value = argv[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --window-days.");
      }

      windowDays = parsePositiveInteger(value, "--window-days");
      index += 1;
      continue;
    }

    if (arg.startsWith("--window-days=")) {
      windowDays = parsePositiveInteger(
        arg.slice("--window-days=".length),
        "--window-days"
      );
      continue;
    }

    if (arg === "--manifest" || arg === "-m") {
      const value = argv[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --manifest.");
      }

      manifestPath = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--manifest=")) {
      manifestPath = arg.slice("--manifest=".length);
      continue;
    }

    if (arg === "--sample-limit" || arg === "-n") {
      const value = argv[index + 1];

      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --sample-limit.");
      }

      sampleLimit = parsePositiveInteger(value, "--sample-limit");
      index += 1;
      continue;
    }

    if (arg.startsWith("--sample-limit=")) {
      sampleLimit = parsePositiveInteger(
        arg.slice("--sample-limit=".length),
        "--sample-limit"
      );
      continue;
    }

    if (!arg.startsWith("-") && !cardCode) {
      cardCode = arg.trim().toUpperCase();
    }
  }

  return {
    cardCode,
    manifestPath,
    windowDays,
    sampleLimit
  };
}

function parsePositiveInteger(value: string, flag: string) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}

function printUsage() {
  console.log("Usage: pnpm audit:pricing-lineage");
  console.log("       pnpm audit:pricing-lineage --window-days 35");
  console.log("       pnpm audit:pricing-lineage --card-code EB02-061 --window-days 35");
  console.log(
    "       pnpm audit:pricing-lineage --manifest tests/fixtures/price-ingestion/card-rush-manual-publish-coverage.json"
  );
}

function resolveSupabaseCredentials(): SupabaseCredentials | null {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    return {
      url: supabaseUrl,
      key: serviceRoleKey,
      keyLabel: "service_role"
    };
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && anonKey) {
    return {
      url: supabaseUrl,
      key: anonKey,
      keyLabel: "anon"
    };
  }

  return null;
}

function formatPercent(numerator: number, denominator: number) {
  if (denominator === 0) {
    return "0.00%";
  }

  return `${((numerator / denominator) * 100).toFixed(2)}%`;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

async function countVisibleRows(
  supabase: AuditSupabaseClient,
  variantIds: readonly string[] | null,
  queryStartIso: string | null
) {
  let query = supabase
    .from("price_history")
    .select("id", { count: "exact", head: true })
    .eq("availability_status", "available")
    .not("price_jpy", "is", null);

  if (variantIds && variantIds.length > 0) {
    query = query.in("variant_id", [...variantIds]);
  }

  if (queryStartIso) {
    query = query.gte("recorded_at", queryStartIso);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count visible price_history rows: ${error.message}`);
  }

  return count ?? 0;
}

async function countQualifiedRows(
  supabase: AuditSupabaseClient,
  variantIds: readonly string[] | null,
  queryStartIso: string | null
) {
  let query = supabase
    .from("price_history")
    .select("id", { count: "exact", head: true })
    .eq("availability_status", "available")
    .not("price_jpy", "is", null)
    .eq("pricing_basis", PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS)
    .not("canonical_price_point_id", "is", null)
    .not("source_day_jst", "is", null);

  if (variantIds && variantIds.length > 0) {
    query = query.in("variant_id", [...variantIds]);
  }

  if (queryStartIso) {
    query = query.gte("recorded_at", queryStartIso);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count qualified canonical rows: ${error.message}`);
  }

  return count ?? 0;
}

async function countRowsByFieldNullability(
  supabase: AuditSupabaseClient,
  variantIds: readonly string[] | null,
  queryStartIso: string | null,
  field: "canonical_price_point_id" | "source_day_jst"
) {
  let query = supabase
    .from("price_history")
    .select("id", { count: "exact", head: true })
    .eq("availability_status", "available")
    .not("price_jpy", "is", null)
    .is(field, null);

  if (variantIds && variantIds.length > 0) {
    query = query.in("variant_id", [...variantIds]);
  }

  if (queryStartIso) {
    query = query.gte("recorded_at", queryStartIso);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count rows missing ${field}: ${error.message}`);
  }

  return count ?? 0;
}

async function countLegacyBasisRows(
  supabase: AuditSupabaseClient,
  variantIds: readonly string[] | null,
  queryStartIso: string | null
) {
  let query = supabase
    .from("price_history")
    .select("id", { count: "exact", head: true })
    .eq("availability_status", "available")
    .not("price_jpy", "is", null)
    .eq("pricing_basis", "daily_best_available_jst");

  if (variantIds && variantIds.length > 0) {
    query = query.in("variant_id", [...variantIds]);
  }

  if (queryStartIso) {
    query = query.gte("recorded_at", queryStartIso);
  }

  const { count, error } = await query;

  if (error) {
    throw new Error(`Failed to count legacy-basis rows: ${error.message}`);
  }

  return count ?? 0;
}

async function loadExcludedRows(
  supabase: AuditSupabaseClient,
  variantIds: readonly string[] | null,
  queryStartIso: string | null,
  sampleLimit: number
) {
  let query = supabase
    .from("price_history")
    .select(
      "id, variant_id, source, price_jpy, recorded_at, pricing_basis, source_day_jst, canonical_price_point_id"
    )
    .eq("availability_status", "available")
    .not("price_jpy", "is", null)
    .or(
      [
        "pricing_basis.is.null",
        `pricing_basis.neq.${PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS}`,
        "canonical_price_point_id.is.null",
        "source_day_jst.is.null"
      ].join(",")
    );

  if (variantIds && variantIds.length > 0) {
    query = query.in("variant_id", [...variantIds]);
  }

  if (queryStartIso) {
    query = query.gte("recorded_at", queryStartIso);
  }

  const { data, error } = await query
    .order("recorded_at", { ascending: false })
    .limit(sampleLimit);

  if (error) {
    throw new Error(`Failed to load excluded price_history sample rows: ${error.message}`);
  }

  return (data as PriceHistoryAuditRow[] | null) ?? [];
}

async function loadVariantsForCard(
  supabase: AuditSupabaseClient,
  cardCode: string
) {
  const { data, error } = await supabase
    .from("card_variants")
    .select("id, card_id, source_variant_key, variant_type")
    .eq("card_id", cardCode)
    .order("source_variant_key", { ascending: true });

  if (error) {
    throw new Error(`Failed to load variants for ${cardCode}: ${error.message}`);
  }

  return (data as VariantRow[] | null) ?? [];
}

async function loadVariantMetadata(
  supabase: AuditSupabaseClient,
  variantIds: readonly string[]
) {
  if (variantIds.length === 0) {
    return new Map<string, VariantRow>();
  }

  const { data, error } = await supabase
    .from("card_variants")
    .select("id, card_id, source_variant_key, variant_type")
    .in("id", [...variantIds]);

  if (error) {
    throw new Error(`Failed to load variant metadata: ${error.message}`);
  }

  return new Map(
    ((data as VariantRow[] | null) ?? []).map((row) => [row.id, row] as const)
  );
}

function describeExcludedRow(row: PriceHistoryAuditRow, variant: VariantRow | undefined) {
  const reasons: string[] = [];

  if (row.pricing_basis !== PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS) {
    reasons.push(`pricing_basis=${row.pricing_basis ?? "null"}`);
  }

  if (!row.canonical_price_point_id) {
    reasons.push("missing canonical_price_point_id");
  }

  if (!row.source_day_jst) {
    reasons.push("missing source_day_jst");
  }

  const variantLabel = variant
    ? `${variant.card_id}:${variant.source_variant_key || variant.variant_type}`
    : row.variant_id;

  return `${variantLabel} ${row.source} ${row.recorded_at} price=${formatValue(
    row.price_jpy
  )} reasons=${reasons.join("; ")}`;
}

function buildCoverageKey(
  variantId: string,
  sourceDayJst: string,
  pricingBasis: string
) {
  return `${variantId}::card_rush::${sourceDayJst}::${pricingBasis}`;
}

async function loadCanonicalRowsForCoverage(
  supabase: AuditSupabaseClient,
  variantIds: readonly string[],
  sourceDays: readonly string[]
) {
  if (variantIds.length === 0 || sourceDays.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("canonical_price_points")
    .select(
      "id, variant_id, source, source_day_jst, pricing_basis, condition_scale, price_jpy"
    )
    .eq("source", "card_rush")
    .in("variant_id", [...variantIds])
    .in("source_day_jst", [...sourceDays]);

  if (error) {
    throw new Error(`Failed to load canonical coverage rows: ${error.message}`);
  }

  return (data as CanonicalPricePointAuditRow[] | null) ?? [];
}

async function loadPublishedRowsForCoverage(
  supabase: AuditSupabaseClient,
  variantIds: readonly string[],
  sourceDays: readonly string[]
) {
  if (variantIds.length === 0 || sourceDays.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("price_history")
    .select(
      "id, variant_id, source, price_jpy, recorded_at, pricing_basis, source_day_jst, canonical_price_point_id"
    )
    .eq("source", "card_rush")
    .eq("availability_status", "available")
    .not("price_jpy", "is", null)
    .in("variant_id", [...variantIds])
    .in("source_day_jst", [...sourceDays]);

  if (error) {
    throw new Error(`Failed to load published coverage rows: ${error.message}`);
  }

  return (data as PriceHistoryAuditRow[] | null) ?? [];
}

async function reconcileManualCoverageManifest(
  supabase: AuditSupabaseClient,
  options: AuditOptions
) {
  const manifest = await loadManualCoverageManifest(
    options.manifestPath ?? defaultManualCoverageManifestPath
  );
  const relevantEntries = options.cardCode
    ? manifest.fixtures.filter((entry) => entry.coverage.cardCode === options.cardCode)
    : manifest.fixtures;

  const expectedRows: ExpectedManifestRow[] = [];
  const expectedEmptyKeys: ExpectedManifestEmptyKey[] = [];

  for (const entry of relevantEntries) {
    const fixture = await loadManualFixture(entry.path);
    const variants = await loadVariantsForCard(supabase, fixture.cardCode);
    const variantMap = new Map(
      variants.map((variant) => [variant.source_variant_key, variant] as const)
    );
    const derivedCandidates = deriveFixtureCanonicalCandidates(fixture);
    const observedDay = getManualPublishDayJst(fixture.observedAt);

    if (!observedDay) {
      throw new Error(`Fixture ${entry.path} has an invalid observedAt timestamp.`);
    }

    for (const expectedSelection of fixture.expectedCanonicalSelections) {
      const variant = variantMap.get(expectedSelection.source_variant_key);

      if (!variant) {
        throw new Error(
          `Fixture ${entry.path} could not resolve variant ${fixture.cardCode}:${expectedSelection.source_variant_key}.`
        );
      }

      const candidate = derivedCandidates.find(
        (row) =>
          row.basis === expectedSelection.pricing_basis &&
          row.sourceDayJst === expectedSelection.source_day_jst &&
          row.observation.sourceListingId === expectedSelection.source_listing_id &&
          row.observation.sourceVariantKey === expectedSelection.source_variant_key
      );

      if (!candidate) {
        throw new Error(
          `Fixture ${entry.path} expected selection ${expectedSelection.source_listing_id} did not derive.`
        );
      }

      expectedRows.push({
        label: entry.path,
        cardCode: fixture.cardCode,
        sourceVariantKey: expectedSelection.source_variant_key,
        variantId: variant.id,
        sourceDayJst: expectedSelection.source_day_jst,
        pricingBasis: expectedSelection.pricing_basis,
        conditionScale: expectedSelection.condition,
        priceJpy: candidate.priceJpy
      });
    }

    if (entry.coverage.expectedOutcome === "no_qualifying_rows") {
      const emptyVariantKeys = [
        ...new Set(
          fixture.cases
            .map((testCase) => testCase.source_variant_key)
            .filter((value): value is string => typeof value === "string" && value.length > 0)
        )
      ];

      for (const sourceVariantKey of emptyVariantKeys) {
        const variant = variantMap.get(sourceVariantKey);

        if (!variant) {
          throw new Error(
            `Fixture ${entry.path} could not resolve empty coverage variant ${fixture.cardCode}:${sourceVariantKey}.`
          );
        }

        expectedEmptyKeys.push({
          label: entry.path,
          cardCode: fixture.cardCode,
          sourceVariantKey,
          variantId: variant.id,
          sourceDayJst: observedDay,
          pricingBasis: manifest.pricingBasis
        });
      }
    }
  }

  const variantIds = [
    ...new Set(
      [
        ...expectedRows.map((row) => row.variantId),
        ...expectedEmptyKeys.map((row) => row.variantId)
      ].filter(Boolean)
    )
  ];
  const sourceDays = [
    ...new Set(
      [
        ...expectedRows.map((row) => row.sourceDayJst),
        ...expectedEmptyKeys.map((row) => row.sourceDayJst)
      ]
    )
  ];

  const actualCanonicalRows = await loadCanonicalRowsForCoverage(
    supabase,
    variantIds,
    sourceDays
  );
  const actualPublishedRows = await loadPublishedRowsForCoverage(
    supabase,
    variantIds,
    sourceDays
  );
  const canonicalMap = new Map(
    actualCanonicalRows.map((row) => [
      buildCoverageKey(row.variant_id, row.source_day_jst, row.pricing_basis),
      row
    ] as const)
  );
  const publishedMap = new Map(
    actualPublishedRows.map((row) => [
      buildCoverageKey(
        row.variant_id,
        row.source_day_jst ?? "",
        row.pricing_basis ?? PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS
      ),
      row
    ] as const)
  );

  const issues: string[] = [];
  let matchedCanonicalRows = 0;
  let matchedPublishedRows = 0;

  for (const expectedRow of expectedRows) {
    const coverageKey = buildCoverageKey(
      expectedRow.variantId,
      expectedRow.sourceDayJst,
      expectedRow.pricingBasis
    );
    const canonicalRow = canonicalMap.get(coverageKey);
    const publishedRow = publishedMap.get(coverageKey);

    if (!canonicalRow) {
      issues.push(
        `missing canonical row for ${expectedRow.cardCode}:${expectedRow.sourceVariantKey} ${expectedRow.sourceDayJst} (${expectedRow.label})`
      );
    } else {
      if (canonicalRow.price_jpy !== expectedRow.priceJpy) {
        issues.push(
          `canonical price mismatch for ${expectedRow.cardCode}:${expectedRow.sourceVariantKey} ${expectedRow.sourceDayJst}: expected ${expectedRow.priceJpy}, found ${canonicalRow.price_jpy ?? "null"}`
        );
      } else if (canonicalRow.condition_scale !== expectedRow.conditionScale) {
        issues.push(
          `canonical condition mismatch for ${expectedRow.cardCode}:${expectedRow.sourceVariantKey} ${expectedRow.sourceDayJst}: expected ${expectedRow.conditionScale}, found ${canonicalRow.condition_scale}`
        );
      } else {
        matchedCanonicalRows += 1;
      }
    }

    if (!publishedRow) {
      issues.push(
        `missing published row for ${expectedRow.cardCode}:${expectedRow.sourceVariantKey} ${expectedRow.sourceDayJst} (${expectedRow.label})`
      );
    } else if (publishedRow.price_jpy !== expectedRow.priceJpy) {
      issues.push(
        `published price mismatch for ${expectedRow.cardCode}:${expectedRow.sourceVariantKey} ${expectedRow.sourceDayJst}: expected ${expectedRow.priceJpy}, found ${publishedRow.price_jpy ?? "null"}`
      );
    } else if (!publishedRow.canonical_price_point_id) {
      issues.push(
        `published row missing canonical_price_point_id for ${expectedRow.cardCode}:${expectedRow.sourceVariantKey} ${expectedRow.sourceDayJst}`
      );
    } else {
      matchedPublishedRows += 1;
    }
  }

  for (const emptyKey of expectedEmptyKeys) {
    const coverageKey = buildCoverageKey(
      emptyKey.variantId,
      emptyKey.sourceDayJst,
      emptyKey.pricingBasis
    );

    if (canonicalMap.has(coverageKey)) {
      issues.push(
        `unexpected canonical row for no_qualifying_rows fixture ${emptyKey.cardCode}:${emptyKey.sourceVariantKey} ${emptyKey.sourceDayJst} (${emptyKey.label})`
      );
    }

    if (publishedMap.has(coverageKey)) {
      issues.push(
        `unexpected published row for no_qualifying_rows fixture ${emptyKey.cardCode}:${emptyKey.sourceVariantKey} ${emptyKey.sourceDayJst} (${emptyKey.label})`
      );
    }
  }

  console.log("");
  console.log(
    `Manual coverage manifest: ${options.manifestPath ?? defaultManualCoverageManifestPath}`
  );
  console.log(`- expected canonical rows: ${expectedRows.length}`);
  console.log(`- matched canonical rows: ${matchedCanonicalRows}`);
  console.log(`- matched published rows: ${matchedPublishedRows}`);
  console.log(`- empty-history checks: ${expectedEmptyKeys.length}`);

  if (issues.length === 0) {
    console.log("- reconciliation: ok");
    return;
  }

  console.log("- reconciliation issues:");
  for (const issue of issues) {
    console.log(`  ${issue}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const credentials = resolveSupabaseCredentials();

  if (!credentials) {
    console.error(
      [
        "Missing Supabase credentials.",
        "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY."
      ].join(" ")
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(credentials.url, credentials.key, {
    auth: {
      persistSession: false
    }
  });

  const queryStartIso =
    options.windowDays !== null ? getRecentJstWindowStartIso(options.windowDays) : null;
  const scopedVariants =
    options.cardCode !== null
      ? await loadVariantsForCard(supabase, options.cardCode)
      : [];

  if (options.cardCode && scopedVariants.length === 0) {
    console.error(`No card_variants rows found for ${options.cardCode}.`);
    process.exitCode = 1;
    return;
  }

  const variantIds = options.cardCode ? scopedVariants.map((variant) => variant.id) : null;
  const visibleCount = await countVisibleRows(supabase, variantIds, queryStartIso);
  const qualifiedCount = await countQualifiedRows(supabase, variantIds, queryStartIso);
  const missingLineageCount = await countRowsByFieldNullability(
    supabase,
    variantIds,
    queryStartIso,
    "canonical_price_point_id"
  );
  const missingSourceDayCount = await countRowsByFieldNullability(
    supabase,
    variantIds,
    queryStartIso,
    "source_day_jst"
  );
  const legacyBasisCount = await countLegacyBasisRows(
    supabase,
    variantIds,
    queryStartIso
  );
  const excludedRows = await loadExcludedRows(
    supabase,
    variantIds,
    queryStartIso,
    options.sampleLimit
  );
  const variantMetadata = await loadVariantMetadata(
    supabase,
    [...new Set(excludedRows.map((row) => row.variant_id))]
  );
  const excludedCount = Math.max(visibleCount - qualifiedCount, 0);

  console.log(
    `Pricing lineage audit using ${credentials.keyLabel} credentials against ${options.cardCode ?? "all cards"}.`
  );
  console.log(
    `Window filter: ${options.windowDays ? `last ${options.windowDays} JST days` : "all published history"}`
  );
  console.log("");
  console.log(`Visible rows: ${visibleCount}`);
  console.log(`Qualified canonical rows: ${qualifiedCount}`);
  console.log(`Excluded rows: ${excludedCount} (${formatPercent(excludedCount, visibleCount)})`);
  console.log("");
  console.log("Non-disjoint exclusion signals:");
  console.log(
    `- missing canonical_price_point_id: ${missingLineageCount} (${formatPercent(
      missingLineageCount,
      visibleCount
    )})`
  );
  console.log(
    `- missing source_day_jst: ${missingSourceDayCount} (${formatPercent(
      missingSourceDayCount,
      visibleCount
    )})`
  );
  console.log(
    `- legacy pricing_basis rows: ${legacyBasisCount} (${formatPercent(
      legacyBasisCount,
      visibleCount
    )})`
  );

  if (excludedRows.length === 0) {
    console.log("");
    console.log("Excluded row sample: none.");
  } else {
    console.log("");
    console.log(`Excluded row sample (${excludedRows.length} rows):`);

    for (const row of excludedRows) {
      console.log(`- ${describeExcludedRow(row, variantMetadata.get(row.variant_id))}`);
    }
  }

  if (options.manifestPath !== null) {
    await reconcileManualCoverageManifest(supabase, options);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Pricing lineage audit failed: ${message}`);
  process.exitCode = 1;
});
