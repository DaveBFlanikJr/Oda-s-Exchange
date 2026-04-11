import fs from "node:fs";
import path from "node:path";

import axios from "axios";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { CreateCard, CreateCardVariant } from "../../lib/types/optcg";
import { isKnownMangaRare } from "./manga-rare-allowlist";

const PUNK_RECORDS_INDEX_URL =
  "https://raw.githubusercontent.com/buhbbl/punk-records/main/japanese/index/cards_by_id.json";
const ENGLISH_CARDS_BASE_URL =
  "https://raw.githubusercontent.com/buhbbl/punk-records/main/english/cards";
const JAPANESE_CARDS_BASE_URL =
  "https://raw.githubusercontent.com/buhbbl/punk-records/main/japanese/cards";
const BATCH_SIZE = 50;
const UPSERT_RETRY_LIMIT = 3;
const UPSERT_RETRY_DELAY_MS = 1_000;

type SupportedPrefix = "OP" | "ST" | "P" | "EB" | "PRB";
type CardType = CreateCard["card_type"];
type VariantSuffix = NonNullable<CreateCardVariant["variant_type"]>;
type RawRecord = Record<string, unknown>;

const VARIANT_SUFFIX_MAP: Array<{ match: RegExp; suffix: VariantSuffix }> = [
  { match: /\bmanga\b/i, suffix: "M" },
  { match: /\b(serial|serialized)\b/i, suffix: "S" },
  { match: /\btreasure\b/i, suffix: "TR" },
  { match: /\b(special|sp)\b/i, suffix: "SP" },
  { match: /\b(alt(\s|-)?art|alternate(\s|-)?art|parallel)\b/i, suffix: "AA" },
  { match: /\bdon\b/i, suffix: "DON" },
  { match: /\bstandard\b/i, suffix: "STD" }
];

const RARITY_LABEL_MAP: Record<string, string> = {
  C: "Common",
  UC: "Uncommon",
  R: "Rare",
  SR: "Super Rare",
  SEC: "Secret Rare",
  SP: "Super Parallel",
  L: "Leader"
};

async function main() {
  loadEnvFiles();

  const supabase = createAdminClient();
  const records = await fetchJapaneseIndexRecords();

  let processed = 0;
  let failed = 0;

  for (const chunk of chunked(records, BATCH_SIZE)) {
    const results = await Promise.allSettled(
      chunk.map((record) => seedRecord(supabase, record))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        if (result.value === "seeded") {
          processed += 1;
        }
      } else {
        failed += 1;
        console.error(`[seed:error] ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
      }
    }
  }

  console.log(
    `[seed:summary] processed=${processed} failed=${failed} total=${records.length}`
  );
}

async function fetchJapaneseIndexRecords() {
  const indexResponse = await axios.get<unknown>(PUNK_RECORDS_INDEX_URL, {
    timeout: 20_000,
    headers: {
      "User-Agent": "OPTCG-Japan-Tracker-Seed/0.1"
    }
  });

  if (!isRawRecord(indexResponse.data)) {
    throw new Error("Punk-Records cards_by_id index did not return an object.");
  }

  return Object.entries(indexResponse.data)
    .filter(([, value]) => isRawRecord(value))
    .map(([id, value]) => ({ id, ...(value as RawRecord) }));
}

async function seedRecord(supabase: SupabaseClient, raw: RawRecord) {
  const normalizedId = normalizeId(getRawId(raw));

  if (!normalizedId) {
    console.error(`[seed:normalize] could not normalize id from record: ${JSON.stringify(raw)}`);
    return "skipped";
  }

  const detailedRaw = await fetchDetailedRecord(raw);
  const mergedRaw = mergeSeedRecords(raw, detailedRaw);
  const card = buildCardPayload(mergedRaw, normalizedId);

  const { error: cardError } = await withRetry(
    () =>
      supabase
        .from("cards")
        .upsert(card, { onConflict: "id" }),
    `cards upsert ${normalizedId}`
  );

  if (cardError) {
    throw new Error(`cards upsert failed for ${normalizedId}: ${cardError.message}`);
  }

  const variants = buildVariantPayloads(mergedRaw, card);

  const { error: variantError } = await withRetry(
    () =>
      supabase
        .from("card_variants")
        .upsert(variants, { onConflict: "card_id,source_variant_key,set_id" }),
    `card_variants upsert ${normalizedId}`
  );

  if (variantError) {
    throw new Error(
      `card_variants upsert failed for ${normalizedId}: ${variantError.message}`
    );
  }

  return "seeded";
}

async function fetchDetailedRecord(raw: RawRecord) {
  const packId = getFirstString(raw, ["pack_id"]);
  const rawId = getRawId(raw);

  if (!packId || !rawId) {
    return null;
  }

  const candidateUrls = [
    `${ENGLISH_CARDS_BASE_URL}/${packId}/${rawId}.json`,
    `${JAPANESE_CARDS_BASE_URL}/${packId}/${rawId}.json`
  ];

  for (const url of candidateUrls) {
    try {
      const response = await axios.get<unknown>(url, {
        timeout: 20_000,
        headers: {
          "User-Agent": "OPTCG-Japan-Tracker-Seed/0.1"
        }
      });

      if (isRawRecord(response.data)) {
        return response.data;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function mergeSeedRecords(indexRaw: RawRecord, detailedRaw: RawRecord | null) {
  if (!detailedRaw) {
    return indexRaw;
  }

  return {
    ...indexRaw,
    ...detailedRaw,
    id: getFirstString(indexRaw, ["id"]) ?? getFirstString(detailedRaw, ["id"]) ?? ""
  };
}

async function withRetry<T>(
  operation: () => PromiseLike<T>,
  label: string
) {
  let lastError: unknown;

  for (let attempt = 1; attempt <= UPSERT_RETRY_LIMIT; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryableUpsertError(error) || attempt === UPSERT_RETRY_LIMIT) {
        throw error;
      }

      console.error(
        `[seed:retry] ${label} attempt=${attempt} reason=${extractErrorMessage(error)}`
      );

      await wait(UPSERT_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`${label} failed after retries.`);
}

export function normalizeId(id: string) {
  const raw = id.trim().toUpperCase();

  if (!raw) {
    return null;
  }

  const withoutVariantTail = raw.replace(/([_-](P|R|AA|SP|TR|M|S|DON)[0-9]*)$/i, "");
  const compact = withoutVariantTail.replace(/[\s_]/g, "");

  const delimited = compact.match(/^([A-Z]{1,3})-?(\d{1,2})?-(\d{1,3})$/);
  if (delimited) {
    return formatNormalizedId(
      delimited[1] as SupportedPrefix | string,
      delimited[2] ?? null,
      delimited[3]
    );
  }

  const compactMatch = compact.match(/^([A-Z]{1,3})(\d{1,2})(\d{1,3})$/);
  if (compactMatch) {
    return formatNormalizedId(
      compactMatch[1] as SupportedPrefix | string,
      compactMatch[2],
      compactMatch[3]
    );
  }

  const promoMatch = compact.match(/^([A-Z]{1,3})-?(\d{1,3})$/);
  if (promoMatch) {
    return formatNormalizedId(
      promoMatch[1] as SupportedPrefix | string,
      null,
      promoMatch[2]
    );
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

function buildCardPayload(raw: RawRecord, normalizedId: string): CreateCard {
  const inferredCardType = inferCardType(raw, normalizedId);
  const nameEn =
    getFirstString(raw, ["name_en", "name", "englishName", "en_name"]) ??
    normalizedId;
  const nameJp =
    getFirstString(raw, ["name_jp", "jp_name", "japaneseName", "ja_name"]) ?? nameEn;
  const attributes = getStringArray(raw, ["attributes"]);
  const colors = getStringArray(raw, ["colors"]);
  const rarityBase = normalizeBaseRarity(
    getFirstString(raw, ["rarity_base", "rarity", "base_rarity"])
  );

  return {
    id: normalizedId,
    card_set_id:
      normalizeSetId(getFirstString(raw, ["pack_id", "card_set_id", "set_id"])) ??
      deriveCardSetId(normalizedId),
    name_en: nameEn,
    name_jp: nameJp,
    card_type: inferredCardType,
    ...(rarityBase ? { rarity_base: rarityBase } : {}),
    attribute:
      getFirstString(raw, ["attribute"]) ?? attributes[0] ?? null,
    color: getFirstString(raw, ["color"]) ?? (colors.join("/") || null),
    cost: parseNullableInteger(raw.cost),
    power: parseNullableInteger(raw.power),
    counter: parseNullableInteger(raw.counter),
    sub_types: extractSubTypes(raw),
    text_en: getFirstString(raw, ["text_en", "effect_en", "card_text_en", "text"]),
    text_jp: getFirstString(raw, ["text_jp", "effect_jp", "card_text_jp"]),
  };
}

function buildVariantPayloads(raw: RawRecord, card: CreateCard) {
  const setId =
    normalizeSetId(
      getFirstString(raw, ["set_id", "set", "pack", "release_set", "pack_id"])
    ) ?? card.card_set_id;
  const imageUrl =
    getFirstString(raw, ["image_url", "card_image_url", "image", "img", "img_full_url"]) ??
    undefined;

  const sourceVariantKey = deriveSourceVariantKey(getRawId(raw), card.card_type);
  const sourceRecordId = normalizeSourceRecordId(getRawId(raw), card.id, sourceVariantKey);
  const suffix = resolveVariantSuffix(
    raw,
    card.card_type,
    card.id,
    setId,
    sourceVariantKey
  );

  return [{
    id: buildVariantId(card.id, suffix, sourceVariantKey),
    card_id: card.id,
    source_record_id: sourceRecordId,
    source_variant_key: sourceVariantKey,
    variant_type: suffix,
    variant_rarity: buildVariantRarity(raw, suffix),
    set_id: setId,
    ...(imageUrl ? { image_url: imageUrl } : {}),
    is_active: true
  }];
}

function resolveVariantSuffix(
  raw: RawRecord,
  cardType: CardType,
  cardId: string,
  setId: string,
  sourceVariantKey: string
) {
  const isMangaRare = isKnownMangaRare(cardId, setId);
  const sourceKeySuffix = mapVariantSuffixFromSourceKey(sourceVariantKey, cardType);

  if (sourceKeySuffix) {
    return coerceMangaVariantSuffix(sourceKeySuffix, isMangaRare);
  }

  const inferredSuffix =
    Array.from(
      new Set(
        extractVariantLabels(raw).map((label) =>
          mapVariantSuffix(label, cardType)
        )
      )
    )[0] ?? "STD";

  return coerceMangaVariantSuffix(inferredSuffix, isMangaRare);
}

function inferCardType(raw: RawRecord, normalizedId: string): CardType {
  const rawCardType = getFirstString(raw, ["card_type", "type", "product_type"]);

  if (rawCardType) {
    const normalized = rawCardType.toLowerCase();
    if (normalized.includes("don")) {
      return "don";
    }
    if (normalized.includes("promo")) {
      return "promo";
    }
    if (normalized.includes("starter")) {
      return "starter";
    }
  }

  if (normalizedId.startsWith("ST")) {
    return "starter";
  }

  if (normalizedId.startsWith("P-")) {
    return "promo";
  }

  if (
    normalizedId.startsWith("OP") ||
    normalizedId.startsWith("EB") ||
    normalizedId.startsWith("PRB")
  ) {
    return "booster";
  }

  return "don";
}

function buildVariantRarity(raw: RawRecord, suffix: VariantSuffix) {
  const explicit =
    getFirstString(raw, [
      "variant_rarity",
      "variant_name",
      "finish",
      "art_type",
      "parallel_type"
    ]) ?? null;

  if (explicit) {
    if (/\bmanga\b/i.test(explicit) && suffix !== "M") {
      return "Alternate Art";
    }

    return explicit;
  }

  switch (suffix) {
    case "AA":
      return "Alternate Art";
    case "M":
      return "Manga Rare";
    case "SP":
      return "Special Card";
    case "TR":
      return "Treasure Rare";
    case "S":
      return "Serial";
    case "DON":
      return "DON";
    case "STD":
    default:
      return "Standard Art";
  }
}

function coerceMangaVariantSuffix(suffix: VariantSuffix, isMangaRare: boolean): VariantSuffix {
  if (suffix !== "M") {
    return suffix;
  }

  return isMangaRare ? "M" : "AA";
}

function mapVariantSuffix(label: string, cardType: CardType): VariantSuffix {
  for (const rule of VARIANT_SUFFIX_MAP) {
    if (rule.match.test(label)) {
      return rule.suffix;
    }
  }

  if (cardType === "don") {
    return "DON";
  }

  return "STD";
}

function deriveSourceVariantKey(rawId: string, cardType: CardType) {
  const normalized = rawId.trim().toUpperCase();

  if (!normalized) {
    return cardType === "don" ? "DON" : "STD";
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

  if (cardType === "don") {
    return "DON";
  }

  return "STD";
}

function mapVariantSuffixFromSourceKey(sourceVariantKey: string, cardType: CardType): VariantSuffix | null {
  if (sourceVariantKey === "STD") {
    return cardType === "don" ? "DON" : "STD";
  }

  if (sourceVariantKey === "DON") {
    return "DON";
  }

  if (sourceVariantKey === "P1") {
    return "AA";
  }

  if (sourceVariantKey === "P2") {
    return "M";
  }

  const numberedParallel = sourceVariantKey.match(/^P(\d+)$/);
  if (numberedParallel) {
    return "AA";
  }

  if (sourceVariantKey === "AA" || sourceVariantKey === "SP" || sourceVariantKey === "TR" || sourceVariantKey === "M" || sourceVariantKey === "S") {
    return sourceVariantKey as VariantSuffix;
  }

  return null;
}

function buildVariantId(cardId: string, variantType: VariantSuffix, sourceVariantKey: string) {
  if (sourceVariantKey === "STD") {
    return `${cardId}_${variantType}`;
  }

  if (sourceVariantKey === "P1" && variantType === "AA") {
    return `${cardId}_AA`;
  }

  // Preserve the legacy P2 -> _M alias so seeded rows remain stable.
  if (sourceVariantKey === "P2") {
    return `${cardId}_M`;
  }

  return `${cardId}_${sourceVariantKey}`;
}

function normalizeSourceRecordId(rawId: string, cardId: string, sourceVariantKey: string) {
  if (sourceVariantKey === "STD") {
    return cardId;
  }

  return rawId.trim().toUpperCase();
}

function extractVariantLabels(raw: RawRecord) {
  const collected: string[] = [];
  const sources = [
    raw.variants,
    raw.variant,
    raw.variant_type,
    raw.finish,
    raw.art_type,
    raw.rarity
  ];

  for (const source of sources) {
    if (typeof source === "string") {
      collected.push(source);
      continue;
    }

    if (Array.isArray(source)) {
      for (const entry of source) {
        if (typeof entry === "string") {
          collected.push(entry);
        } else if (isRawRecord(entry)) {
          const nested =
            getFirstString(entry, ["name", "label", "type", "variant", "rarity"]) ?? null;
          if (nested) {
            collected.push(nested);
          }
        }
      }
    }
  }

  if (collected.length === 0) {
    collected.push("Standard");
  }

  return collected;
}

function extractSubTypes(raw: RawRecord) {
  const candidates = [raw.tags, raw.sub_types, raw.subTypes, raw.types];
  const values: string[] = [];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      for (const entry of candidate) {
        if (typeof entry === "string" && entry.trim()) {
          values.push(entry.trim());
        } else if (isRawRecord(entry)) {
          const label = getFirstString(entry, ["name", "label", "value"]);
          if (label) {
            values.push(label);
          }
        }
      }
    }
  }

  return Array.from(new Set(values));
}

function getStringArray(source: RawRecord, keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  }

  return [];
}

function deriveCardSetId(normalizedId: string) {
  return normalizedId.split("-")[0];
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

function normalizeBaseRarity(rawRarity: string | null) {
  if (!rawRarity) {
    return null;
  }

  const compact = rawRarity.trim().toUpperCase().replace(/[\s_-]/g, "");

  if (compact in RARITY_LABEL_MAP) {
    return RARITY_LABEL_MAP[compact];
  }

  if (compact === "SUPERRARE") {
    return "Super Rare";
  }

  if (compact === "SECRETRARE") {
    return "Secret Rare";
  }

  if (compact === "SUPERPARALLEL") {
    return "Super Parallel";
  }

  if (compact === "UNCOMMON") {
    return "Uncommon";
  }

  if (compact === "COMMON") {
    return "Common";
  }

  if (compact === "RARE") {
    return "Rare";
  }

  if (compact === "LEADER") {
    return "Leader";
  }

  return rawRarity.trim();
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

function parseNullableInteger(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/[^0-9-]/g, "");
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function isRetryableUpsertError(error: unknown) {
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

function isSupportedPrefix(prefix: string): prefix is SupportedPrefix {
  return (
    prefix === "OP" ||
    prefix === "ST" ||
    prefix === "P" ||
    prefix === "EB" ||
    prefix === "PRB"
  );
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
  console.error(`[seed:fatal] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
