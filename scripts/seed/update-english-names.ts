import fs from "node:fs";
import path from "node:path";

import axios from "axios";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ENGLISH_INDEX_URL =
  "https://raw.githubusercontent.com/buhbbl/punk-records/main/english/index/cards_by_id.json";
const BATCH_SIZE = 50;
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 1_000;

type RawRecord = Record<string, unknown>;

async function main() {
  loadEnvFiles();

  const supabase = createAdminClient();
  const englishRecords = await fetchEnglishIndexRecords();

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const chunk of chunked(englishRecords, BATCH_SIZE)) {
    const results = await Promise.allSettled(
      chunk.map((record) => updateEnglishName(supabase, record))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === "updated") {
          updated += 1;
        } else {
          skipped += 1;
        }
      } else {
        failed += 1;
        console.error(
          `[english-names:error] ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        );
      }
    }
  }

  console.log(
    `[english-names:summary] updated=${updated} skipped=${skipped} failed=${failed} total=${englishRecords.length}`
  );
}

async function fetchEnglishIndexRecords() {
  const response = await axios.get<unknown>(ENGLISH_INDEX_URL, {
    timeout: 20_000,
    headers: {
      "User-Agent": "OPTCG-Japan-Tracker-EnglishNames/0.1"
    }
  });

  if (!isRawRecord(response.data)) {
    throw new Error("English cards_by_id index did not return an object.");
  }

  return Object.entries(response.data)
    .filter(([, value]) => isRawRecord(value))
    .map(([id, value]) => ({ id, ...(value as RawRecord) }));
}

async function updateEnglishName(supabase: SupabaseClient, raw: RawRecord) {
  const normalizedId = normalizeId(getFirstString(raw, ["id", "card_id"]) ?? "");

  if (!normalizedId) {
    console.error(
      `[english-names:normalize] could not normalize id from record: ${JSON.stringify(raw)}`
    );
    return "skipped";
  }

  const englishName =
    getFirstString(raw, ["name_en", "name", "englishName", "en_name"]) ?? null;

  if (!englishName) {
    return "skipped";
  }

  const expectedSetId =
    normalizeSetId(getFirstString(raw, ["pack_id", "set_id", "card_set_id"])) ??
    deriveCardSetId(normalizedId);

  const { data, error } = await withRetry(
    () =>
      supabase
        .from("cards")
        .select("id, card_set_id")
        .eq("id", normalizedId)
        .maybeSingle(),
    `cards lookup ${normalizedId}`
  );

  if (error) {
    throw new Error(`cards lookup failed for ${normalizedId}: ${error.message}`);
  }

  if (!data) {
    return "skipped";
  }

  if (data.card_set_id !== expectedSetId) {
    console.error(
      `[english-names:set-mismatch] id=${normalizedId} expected=${expectedSetId} actual=${data.card_set_id}`
    );
    return "skipped";
  }

  const { error: updateError } = await withRetry(
    () =>
      supabase
        .from("cards")
        .update({ name_en: englishName })
        .eq("id", normalizedId),
    `cards update ${normalizedId}`
  );

  if (updateError) {
    throw new Error(`cards update failed for ${normalizedId}: ${updateError.message}`);
  }

  return "updated";
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
        `[english-names:retry] ${label} attempt=${attempt} reason=${extractErrorMessage(error)}`
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

function normalizeSetId(rawSetId: string | null) {
  if (!rawSetId) {
    return null;
  }

  const upper = rawSetId.trim().toUpperCase().replace(/[\s_]/g, "");
  const compact = upper.replace(/-/g, "");

  if (/^[A-Z]{1,3}([0-9]{2})?$/.test(compact)) {
    return compact;
  }

  const match = upper.match(/^([A-Z]{1,3})-?([0-9]{1,2})$/);
  if (!match) {
    return null;
  }

  return `${match[1]}${match[2].padStart(2, "0")}`;
}

function deriveCardSetId(normalizedId: string) {
  return normalizedId.split("-")[0];
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
    `[english-names:fatal] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
