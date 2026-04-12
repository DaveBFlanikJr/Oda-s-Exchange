import {
  PRICE_INGESTION_CONDITION_SCALES,
  PRICE_INGESTION_LISTING_KINDS,
  PRICE_INGESTION_SOURCE_POLICY_STATUSES,
  type PriceIngestionConditionScale,
  type PriceIngestionListingKind,
  type PriceIngestionSourcePolicyStatus
} from "@/lib/pricing/ingestion/constants";

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

function includesAny(text: string, markers: string[]) {
  return markers.some((marker) => text.includes(marker));
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

export function normalizeSourcePolicyStatus(
  value: string | null | undefined
): PriceIngestionSourcePolicyStatus {
  const normalized = normalizeText(value);

  if (
    PRICE_INGESTION_SOURCE_POLICY_STATUSES.includes(
      normalized as PriceIngestionSourcePolicyStatus
    )
  ) {
    return normalized as PriceIngestionSourcePolicyStatus;
  }

  if (includesAny(normalized, ["approved", "allowed", "permitted"])) {
    return "approved";
  }

  if (includesAny(normalized, ["fixture", "manual only", "manual", "sample only"])) {
    return "restricted";
  }

  if (includesAny(normalized, ["blocked", "denied", "prohibited", "forbidden"])) {
    return "denied";
  }

  return "unknown";
}

export function normalizeConditionScale(
  value: string | null | undefined
): PriceIngestionConditionScale {
  const normalized = normalizeText(value);

  if (normalized === "") {
    return "unknown";
  }

  if (
    matchesAny(normalized, [
      /\b(psa|bgs|cgc|ars|beckett|graded|slabbed)\b/,
      /鑑定/,
      /grade\s*\d{1,2}/
    ])
  ) {
    return "graded";
  }

  if (
    matchesAny(normalized, [
      /\b(damaged|poor|heavily played|hp|junk|broken)\b/,
      /ジャンク/,
      /訳あり/,
      /傷/,
      /折れ/,
      /破れ/,
      /欠け/,
      /水濡れ/,
      /状態c/
    ])
  ) {
    return "damaged";
  }

  if (
    matchesAny(normalized, [
      /\b(moderate play|mp)\b/,
      /状態b/,
      /moderately played/
    ])
  ) {
    return "moderate_play";
  }

  if (
    matchesAny(normalized, [
      /\b(light play|lp)\b/,
      /played/,
      /minor scratch/,
      /slight/
    ])
  ) {
    return "light_play";
  }

  if (
    matchesAny(normalized, [
      /\b(near mint|nm|nm\/mt|nm-mint)\b/,
      /状態a-/,
      /ほぼ新品/,
      /極美品/
    ])
  ) {
    return "near_mint";
  }

  if (
    matchesAny(normalized, [
      /\b(mint|m\/nm|mint condition)\b/,
      /新品/,
      /未使用/,
      /美品/,
      /状態a\+/,
      /状態a\b/
    ])
  ) {
    return "mint";
  }

  return "unknown";
}

export function normalizeListingKind(
  value: string | null | undefined
): PriceIngestionListingKind {
  const normalized = normalizeText(value);

  if (normalized === "") {
    return "unknown";
  }

  const hasProxyOrCustom = matchesAny(normalized, [
    /\b(proxy|custom|reproduction|replica|fake|counterfeit|print|sticker)\b/,
    /プロキシ/,
    /カスタム/,
    /自作/,
    /複製/,
    /印刷/,
    /シール/
  ]);

  if (hasProxyOrCustom) {
    return "proxy_custom";
  }

  const hasGraded = matchesAny(normalized, [
    /\b(psa|bgs|cgc|ars|beckett|graded|slabbed)\b/,
    /鑑定/
  ]);

  if (hasGraded) {
    return "graded_card";
  }

  const hasDeckProduct = matchesAny(normalized, [
    /\b(deck|starter deck|theme deck|structure deck)\b/,
    /デッキ/,
    /構築済/,
    /スタータ/,
    /収録内容/
  ]);

  if (hasDeckProduct) {
    return "deck_product";
  }

  const hasSealedProduct = matchesAny(normalized, [
    /\b(sealed|box|pack|booster box)\b/,
    /未開封/,
    /シュリンク/,
    /ブースターボックス/,
    /パック/
  ]);

  if (hasSealedProduct) {
    return "sealed_product";
  }

  const conditionScale = normalizeConditionScale(normalized);
  if (conditionScale !== "unknown") {
    return "single_card";
  }

  const hasAmbiguousMarkers = includesAny(normalized, [" or ", "/", "・", "／"]);
  if (hasAmbiguousMarkers) {
    return "ambiguous";
  }

  if (
    PRICE_INGESTION_LISTING_KINDS.includes(
      normalized as PriceIngestionListingKind
    )
  ) {
    return normalized as PriceIngestionListingKind;
  }

  return "single_card";
}
