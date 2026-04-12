import { createClient } from "@supabase/supabase-js";

type SupabaseCredentials = {
  url: string;
  key: string;
  keyLabel: "service_role" | "anon";
};

type Row = Record<string, unknown>;

type AuditOptions = {
  cardCode: string;
};

function parseArgs(argv: string[]): AuditOptions {
  let cardCode = "EB02-061";

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
      cardCode = value;
      index += 1;
      continue;
    }

    if (arg.startsWith("--card-code=")) {
      cardCode = arg.slice("--card-code=".length);
      continue;
    }

    if (!arg.startsWith("-")) {
      cardCode = arg;
    }
  }

  return { cardCode: cardCode.trim().toUpperCase() };
}

function printUsage() {
  console.log("Usage: pnpm exec tsx scripts/price-ingestion/variant-identity-audit.ts [card-code]");
  console.log("       pnpm exec tsx scripts/price-ingestion/variant-identity-audit.ts --card-code EB02-061");
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

function formatValue(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

function getPrintableFields(row: Row, fieldNames: string[]) {
  return fieldNames
    .filter((fieldName) => Object.prototype.hasOwnProperty.call(row, fieldName))
    .map((fieldName) => [fieldName, row[fieldName]] as const);
}

function normalizeKey(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function assessIdentityBroadness(variant: Row, variantCount: number) {
  const reasons: string[] = [];
  const sourceVariantKey = normalizeKey(variant.source_variant_key);
  const variantType = normalizeKey(variant.variant_type);
  const imageUrl = typeof variant.image_url === "string" ? variant.image_url.trim() : "";

  if (!sourceVariantKey) {
    reasons.push("missing source_variant_key");
  }

  if (variantCount > 1 && sourceVariantKey === "STD") {
    reasons.push("generic STD key on a multi-variant card");
  }

  if (variantCount > 1 && variantType === "STD" && !imageUrl) {
    reasons.push("standard variant row without a stronger treatment cue");
  }

  return {
    looksTooBroad: reasons.length > 0,
    reasons
  };
}

function sortVariants(a: Row, b: Row) {
  const aKey = normalizeKey(a.source_variant_key) || a.id?.toString() || "";
  const bKey = normalizeKey(b.source_variant_key) || b.id?.toString() || "";

  return aKey.localeCompare(bKey) || String(a.id ?? "").localeCompare(String(b.id ?? ""));
}

async function main() {
  const { cardCode } = parseArgs(process.argv.slice(2));
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

  console.log(`Auditing card ${cardCode} using ${credentials.keyLabel} credentials.`);

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select("*")
    .eq("id", cardCode)
    .maybeSingle();

  if (cardError) {
    console.error(`Unable to load card ${cardCode}: ${cardError.message}`);
    process.exitCode = 1;
    return;
  }

  if (!card) {
    console.error(`No card row found for ${cardCode}.`);
    process.exitCode = 1;
    return;
  }

  const { data: variants, error: variantError } = await supabase
    .from("card_variants")
    .select("*")
    .eq("card_id", cardCode);

  if (variantError) {
    console.error(`Unable to load variants for ${cardCode}: ${variantError.message}`);
    process.exitCode = 1;
    return;
  }

  const sortedVariants = (variants ?? []).slice().sort(sortVariants);
  const cardIdentityFields = getPrintableFields(card, [
    "id",
    "name_en",
    "name_jp",
    "rarity_base",
    "card_type",
    "color",
    "cost",
    "power",
    "counter",
    "text_en",
    "text_jp"
  ]);

  console.log("");
  console.log("Card");
  for (const [fieldName, value] of cardIdentityFields) {
    console.log(`- ${fieldName}: ${formatValue(value)}`);
  }

  console.log("");
  console.log(`Variants (${sortedVariants.length})`);

  if (sortedVariants.length === 0) {
    console.log("- no card_variants rows found");
    return;
  }

  for (const variant of sortedVariants) {
    const broadness = assessIdentityBroadness(variant, sortedVariants.length);
    const fieldEntries = getPrintableFields(variant, [
      "id",
      "card_id",
      "source_variant_key",
      "variant_type",
      "variant_rarity",
      "display_name",
      "display_name_en",
      "display_name_jp",
      "name",
      "name_en",
      "name_jp",
      "image_url",
      "set_id",
      "is_active"
    ]);

    console.log("");
    console.log(`- variant: ${formatValue(variant.id)}`);
    for (const [fieldName, value] of fieldEntries) {
      if (fieldName === "id") {
        continue;
      }
      console.log(`  ${fieldName}: ${formatValue(value)}`);
    }
    console.log(`  identity_too_broad: ${broadness.looksTooBroad ? "yes" : "no"}`);
    if (broadness.reasons.length > 0) {
      console.log(`  broadness_reasons: ${broadness.reasons.join("; ")}`);
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Variant identity audit failed: ${message}`);
  process.exitCode = 1;
});
