import fs from "node:fs";
import path from "node:path";

import axios from "axios";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { VariantType } from "../../lib/types/cards";

const JAPANESE_INDEX_URL =
  "https://raw.githubusercontent.com/buhbbl/punk-records/main/japanese/index/cards_by_id.json";
const ENGLISH_CARDS_BASE_URL =
  "https://raw.githubusercontent.com/buhbbl/punk-records/main/english/cards";
const JAPANESE_CARDS_BASE_URL =
  "https://raw.githubusercontent.com/buhbbl/punk-records/main/japanese/cards";
const BATCH_SIZE = 50;
const SELECT_PAGE_SIZE = 1000;
const RETRY_LIMIT = 3;
const RETRY_DELAY_MS = 1_000;

type RawRecord = Record<string, unknown>;
type VariantRow = {
  id: string;
  card_id: string;
  variant_type: VariantType;
  source_record_id: string;
  source_variant_key: string;
  set_id: string;
};

const VARIANT_SUFFIX_MAP: Array<{ match: RegExp; suffix: VariantType }> = [
  { match: /\bmanga\b/i, suffix: "M" },
  { match: /\b(serial|serialized)\b/i, suffix: "S" },
  { match: /\btreasure\b/i, suffix: "TR" },
  { match: /\b(special|sp)\b/i, suffix: "SP" },
  { match: /\b(alt(\s|-)?art|alternate(\s|-)?art|parallel)\b/i, suffix: "AA" },
  { match: /\bdon\b/i, suffix: "DON" },
  { match: /\bstandard\b/i, suffix: "STD" }
];

async function main() {
  loadEnvFiles();

  const supabase = createAdminClient();
  const variants = await fetchMissingImageVariants(supabase);
  const sourceRecords = await fetchJapaneseDetailedRecords();
  const sourceMap = buildSourceMap(sourceRecords);

  let updated = 0;
  let missing = 0;
  let failed = 0;

  for (const chunk of chunked(variants, BATCH_SIZE)) {
    const results = await Promise.allSettled(
      chunk.map(async (variant) => {
        const source = sourceMap.get(`${variant.card_id}:${variant.source_variant_key}`);

        if (!source?.imgFullUrl) {
          return "missing";
        }

        const { error } = await withRetry(
          () =>
            supabase
              .from("card_variants")
              .update({ image_url: source.imgFullUrl })
              .eq("id", variant.id)
              .is("image_url", null),
          `image update ${variant.id}`
        );

        if (error) {
          throw new Error(`image update failed for ${variant.id}: ${error.message}`);
        }

        return "updated";
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === "updated") {
          updated += 1;
        } else {
          missing += 1;
        }
      } else {
        failed += 1;
        console.error(
          `[backfill-images:error] ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        );
      }
    }
  }

  console.log(
    `[backfill-images:summary] updated=${updated} missing=${missing} failed=${failed} total=${variants.length}`
  );
}

async function fetchMissingImageVariants(supabase: SupabaseClient) {
  const rows: VariantRow[] = [];
  let from = 0;

  while (true) {
    const to = from + SELECT_PAGE_SIZE - 1;
    const { data, error } = await withRetry(
      () =>
        supabase
          .from("card_variants")
          .select("id, card_id, variant_type, source_record_id, source_variant_key, set_id")
          .is("image_url", null)
          .range(from, to),
      `fetch missing image variants ${from}-${to}`
    );

    if (error) {
      throw new Error(`Failed to fetch variants missing images: ${error.message}`);
    }

    const page = (data ?? []) as VariantRow[];
    rows.push(...page);

    if (page.length < SELECT_PAGE_SIZE) {
      break;
    }

    from += SELECT_PAGE_SIZE;
  }

  return rows;
}

async function fetchJapaneseDetailedRecords() {
  const response = await axios.get<unknown>(JAPANESE_INDEX_URL, {
    timeout: 20_000,
    headers: {
      "User-Agent": "OPTCG-Japan-Tracker-ImageBackfill/0.1"
    }
  });

  if (!isRawRecord(response.data)) {
    throw new Error("Japanese cards_by_id index did not return an object.");
  }

  const indexEntries = Object.entries(response.data)
    .filter(([, value]) => isRawRecord(value))
    .map(([id, value]) => ({ id, ...(value as RawRecord) }));

  const detailedRecords: RawRecord[] = [];

  for (const chunk of chunked(indexEntries, BATCH_SIZE)) {
    const results = await Promise.allSettled(
      chunk.map(async (entry) => {
        const packId = getFirstString(entry, ["pack_id"]);
        const rawId = getFirstString(entry, ["id", "card_id"]);

        if (!packId || !rawId) {
          return null;
        }

        return fetchDetailedRecord(packId, rawId);
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value) {
          detailedRecords.push(result.value);
        }
      } else {
        console.error(
          `[backfill-images:pack-fetch] ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`
        );
      }
    }
  }

  return detailedRecords;
}

function buildSourceMap(records: RawRecord[]) {
  const map = new Map<string, { imgFullUrl: string }>();

  for (const record of records) {
    const normalizedId = normalizeId(getFirstString(record, ["id", "card_id"]) ?? "");
    const imgFullUrl = getFirstString(record, ["img_full_url", "image_url", "img_url"]);
    const sourceVariantKey = deriveSourceVariantKey(getFirstString(record, ["id", "card_id"]) ?? "");

    if (!normalizedId || !imgFullUrl || !sourceVariantKey) {
      continue;
    }

    const key = `${normalizedId}:${sourceVariantKey}`;

    if (!map.has(key)) {
      map.set(key, { imgFullUrl });
    }
  }

  return map;
}

function deriveSourceVariantKey(rawId: string) {
  const normalized = rawId.trim().toUpperCase();

  if (!normalized) {
    return null;
  }

  const numberedParallel = normalized.match(/(?:_|-)(P\d+)$/);
  if (numberedParallel) {
    return numberedParallel[1];
  }

  const numberedStandard = normalized.match(/(?:_|-)(R\d+)$/);
  if (numberedStandard) {
    return "STD";
  }

  const explicitSuffix = normalized.match(/(?:_|-)(AA|SP|TR|M|S|DON)$/);
  if (explicitSuffix) {
    return explicitSuffix[1];
  }

  if (normalizeId(rawId)?.startsWith("DON")) {
    return "DON";
  }

  return "STD";
}

async function fetchDetailedRecord(packId: string, rawId: string) {
  const normalizedCardId = normalizeId(rawId);
  const sourceVariantKey = deriveSourceVariantKey(rawId);
  const rawRecordId = rawId.trim();
  const candidateIds = Array.from(
    new Set(
      [
        rawRecordId,
        sourceVariantKey === "STD" ? normalizedCardId : null
      ].filter((value): value is string => Boolean(value))
    )
  );

  const candidates = candidateIds.flatMap((candidateId) => [
    `${ENGLISH_CARDS_BASE_URL}/${packId}/${candidateId}.json`,
    `${JAPANESE_CARDS_BASE_URL}/${packId}/${candidateId}.json`
  ]);

  for (const url of candidates) {
    try {
      const response = await axios.get<unknown>(url, {
        timeout: 20_000,
        headers: {
          "User-Agent": "OPTCG-Japan-Tracker-ImageBackfill/0.1"
        }
      });

      if (isRawRecord(response.data)) {
        return response.data;
      }
    } catch {
      continue;
    }
  }

  throw new Error(`Detailed record not found for ${packId}/${rawId}`);
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
        `[backfill-images:retry] ${label} attempt=${attempt} reason=${extractErrorMessage(error)}`
      );

      await wait(RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after retries.`);
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
    `[backfill-images:fatal] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
});
