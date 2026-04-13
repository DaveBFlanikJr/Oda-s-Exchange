import fs from "node:fs";
import path from "node:path";

import axios from "axios";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const JAPANESE_INDEX_URL =
  "https://raw.githubusercontent.com/buhbbl/punk-records/main/japanese/index/cards_by_id.json";
const ENGLISH_INDEX_URL =
  "https://raw.githubusercontent.com/buhbbl/punk-records/main/english/index/cards_by_id.json";
const BATCH_SIZE = 50;
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 1_000;

type RawRecord = Record<string, unknown>;
type ExistingCardRecord = {
  id: string;
  name_en: string;
  name_jp: string | null;
};
type RepairOptions = {
  apply: boolean;
};

async function main() {
  loadEnvFiles();

  const options = parseArgs(process.argv.slice(2));
  const supabase = createAdminClient();
  const japaneseRecords = await fetchIndexRecords(
    JAPANESE_INDEX_URL,
    "Punk-Records Japanese cards_by_id index"
  );
  const englishRecordsById = buildRecordMapByNormalizedId(
    await fetchIndexRecords(
      ENGLISH_INDEX_URL,
      "Punk-Records English cards_by_id index"
    )
  );
  const normalizedJapaneseIds = Array.from(
    new Set(
      japaneseRecords
        .map((record) => normalizeId(getRawId(record)))
        .filter((id): id is string => Boolean(id))
    )
  );
  const existingCardsById = await fetchExistingCardsById(
    supabase,
    normalizedJapaneseIds
  );

  let missingEnglishRecord = 0;
  let missingEnglishName = 0;
  let missingCard = 0;
  let unchanged = 0;
  let wouldUpdate = 0;
  let updated = 0;
  let failed = 0;

  const candidates: Array<{
    id: string;
    currentNameEn: string;
    nextNameEn: string;
  }> = [];

  for (const id of normalizedJapaneseIds) {
    const englishRecord = englishRecordsById.get(id);
    if (!englishRecord) {
      missingEnglishRecord += 1;
      continue;
    }

    const englishName = getFirstString(
      englishRecord,
      ["name_en", "englishName", "en_name", "name"]
    );
    if (!englishName) {
      missingEnglishName += 1;
      continue;
    }

    const existingCard = existingCardsById.get(id);
    if (!existingCard) {
      missingCard += 1;
      continue;
    }

    if (existingCard.name_en === englishName) {
      unchanged += 1;
      continue;
    }

    wouldUpdate += 1;
    candidates.push({
      id,
      currentNameEn: existingCard.name_en,
      nextNameEn: englishName
    });
  }

  if (options.apply) {
    for (const chunk of chunked(candidates, BATCH_SIZE)) {
      const results = await Promise.allSettled(
        chunk.map((candidate) =>
          updateEnglishName(supabase, candidate.id, candidate.nextNameEn)
        )
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          updated += 1;
        } else {
          failed += 1;
          console.error(
            `[english-names:repair:error] ${
              result.reason instanceof Error ? result.reason.message : String(result.reason)
            }`
          );
        }
      }
    }
  }

  console.log(
    [
      `[english-names:repair:summary] mode=${options.apply ? "apply" : "dry-run"}`,
      `japanese_ids=${normalizedJapaneseIds.length}`,
      `english_records=${englishRecordsById.size}`,
      `would_update=${wouldUpdate}`,
      `updated=${updated}`,
      `unchanged=${unchanged}`,
      `missing_english_record=${missingEnglishRecord}`,
      `missing_english_name=${missingEnglishName}`,
      `missing_card=${missingCard}`,
      `failed=${failed}`
    ].join(" ")
  );

  for (const candidate of candidates.slice(0, 10)) {
    console.log(
      `[english-names:repair:sample] id=${candidate.id} current=${JSON.stringify(
        candidate.currentNameEn
      )} next=${JSON.stringify(candidate.nextNameEn)}`
    );
  }
}

function parseArgs(argv: string[]): RepairOptions {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  return {
    apply: argv.includes("--apply")
  };
}

function printUsage() {
  console.log("Usage: pnpm seed:repair-english-names [-- --apply]");
  console.log("Runs a dry-run audit by default. Pass --apply to update cards.name_en.");
}

async function fetchIndexRecords(url: string, label: string) {
  const response = await axios.get<unknown>(url, {
    timeout: 20_000,
    headers: {
      "User-Agent": "OPTCG-Japan-Tracker-EnglishNameRepair/0.1"
    }
  });

  if (!isRawRecord(response.data)) {
    throw new Error(`${label} did not return an object.`);
  }

  return Object.entries(response.data)
    .filter(([, value]) => isRawRecord(value))
    .map(([id, value]) => ({ id, ...(value as RawRecord) }));
}

function buildRecordMapByNormalizedId(records: RawRecord[]) {
  const recordsById = new Map<string, RawRecord>();

  for (const record of records) {
    const normalizedId = normalizeId(getRawId(record));
    if (normalizedId) {
      recordsById.set(normalizedId, record);
    }
  }

  return recordsById;
}

async function fetchExistingCardsById(
  supabase: SupabaseClient,
  ids: readonly string[]
) {
  const cardsById = new Map<string, ExistingCardRecord>();

  for (const chunk of chunked(Array.from(new Set(ids)), BATCH_SIZE)) {
    const { data, error } = await withRetry(
      () =>
        supabase
          .from("cards")
          .select("id, name_en, name_jp")
          .in("id", chunk),
      "cards lookup"
    );

    if (error) {
      throw new Error(`cards lookup failed: ${error.message}`);
    }

    for (const row of (data ?? []) as ExistingCardRecord[]) {
      cardsById.set(row.id, row);
    }
  }

  return cardsById;
}

async function updateEnglishName(
  supabase: SupabaseClient,
  id: string,
  englishName: string
) {
  const { error } = await withRetry(
    () =>
      supabase
        .from("cards")
        .update({ name_en: englishName })
        .eq("id", id),
    `cards update ${id}`
  );

  if (error) {
    throw new Error(`cards update failed for ${id}: ${error.message}`);
  }
}

async function withRetry<T>(operation: () => PromiseLike<T>, label: string) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= RETRY_LIMIT; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableError(error) || attempt === RETRY_LIMIT) {
        throw error;
      }

      console.error(
        `[english-names:repair:retry] ${label} attempt=${attempt} reason=${extractErrorMessage(error)}`
      );

      await wait(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after retries.`);
}

function normalizeId(id: string) {
  const raw = id.trim().toUpperCase();

  if (!raw) {
    return null;
  }

  const withoutVariantTail = raw.replace(/([_-](P|R|AA|SP|TR|M|S|DON)[0-9]*)$/i, "");
  const compact = withoutVariantTail.replace(/[\s_]/g, "");

  const delimited = compact.match(/^([A-Z]{1,3})-?(\d{1,2})?-(\d{1,3})$/);
  if (delimited) {
    return formatNormalizedId(delimited[1], delimited[2] ?? null, delimited[3]);
  }

  const compactMatch = compact.match(/^([A-Z]{1,3})(\d{1,2})(\d{1,3})$/);
  if (compactMatch) {
    return formatNormalizedId(compactMatch[1], compactMatch[2], compactMatch[3]);
  }

  const promoMatch = compact.match(/^([A-Z]{1,3})-?(\d{1,3})$/);
  if (promoMatch) {
    return formatNormalizedId(promoMatch[1], null, promoMatch[2]);
  }

  return null;
}

function formatNormalizedId(prefix: string, setPart: string | null, cardPart: string) {
  const normalizedPrefix = prefix.toUpperCase();

  if (!isSupportedPrefix(normalizedPrefix)) {
    return null;
  }

  const normalizedCard = String(Number.parseInt(cardPart, 10)).padStart(3, "0");

  if (setPart) {
    const normalizedSet = String(Number.parseInt(setPart, 10)).padStart(2, "0");
    return `${normalizedPrefix}${normalizedSet}-${normalizedCard}`;
  }

  return `${normalizedPrefix}-${normalizedCard}`;
}

function getRawId(raw: RawRecord) {
  return (
    getFirstString(raw, ["id", "card_number", "code", "number", "card_id"]) ?? ""
  );
}

function getFirstString(source: RawRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function chunked<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function isRawRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null;
}

function isSupportedPrefix(prefix: string) {
  return prefix === "OP" || prefix === "ST" || prefix === "P" || prefix === "EB" || prefix === "PRB";
}

function isRetryableError(error: unknown) {
  const message = extractErrorMessage(error).toLowerCase();

  return (
    message.includes("502") ||
    message.includes("bad gateway") ||
    message.includes("fetch failed") ||
    message.includes("gateway")
  );
}

function extractErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function wait(durationMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function createAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

function loadEnvFiles() {
  const cwd = process.cwd();
  const files = [".env.local", ".env", ".env.test.local"];

  for (const file of files) {
    const fullPath = path.join(cwd, file);

    if (!fs.existsSync(fullPath)) {
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();

      if (process.env[key]) {
        continue;
      }

      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
}

main().catch((error) => {
  console.error(
    `[english-names:repair:fatal] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
