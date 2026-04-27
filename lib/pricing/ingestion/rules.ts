import type {
  PriceIngestionConditionScale,
  PriceIngestionListingKind,
  PriceIngestionSourcePolicyStatus
} from "@/lib/pricing/ingestion/constants";

export type PriceIngestionMarkerCategory =
  | "manga"
  | "illustrator"
  | "alt_art"
  | "condition"
  | "graded"
  | "sealed"
  | "deck_product"
  | "proxy_custom";

export type TextTokenRule<TOutput> = {
  token: string;
  output: TOutput;
  matchMode: "substring" | "word";
};

export type RegexRule<TOutput> = {
  label: string;
  output: TOutput;
  pattern: RegExp;
  matchMode: "regex";
};

export function normalizeClassifierText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeClassifierSearchText(value: string) {
  return normalizeClassifierText(value).toLowerCase();
}

export function normalizeCoercionText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
}

export function matchesTextTokenRule<TOutput>(
  normalizedText: string,
  rule: TextTokenRule<TOutput>
) {
  const normalizedToken = rule.token.toLowerCase();

  switch (rule.matchMode) {
    case "substring":
      return normalizedText.includes(normalizedToken);
    case "word":
      return matchesLatinWordToken(normalizedText, normalizedToken);
  }
}

function matchesLatinWordToken(normalizedText: string, normalizedToken: string) {
  const escapedToken = normalizedToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^a-z0-9])${escapedToken}(?=$|[^a-z0-9])`, "i");

  return pattern.test(normalizedText);
}

export function matchesRegexRule<TOutput>(text: string, rule: RegexRule<TOutput>) {
  rule.pattern.lastIndex = 0;
  return rule.pattern.test(text);
}

export const CLASSIFIER_MANGA_MARKER_RULES = [
  { token: "漫画背景", output: "manga", matchMode: "substring" },
  { token: "漫画絵", output: "manga", matchMode: "substring" },
  { token: "コミックパラレル", output: "manga", matchMode: "substring" },
  { token: "コミパラ", output: "manga", matchMode: "substring" },
  { token: "漫画背景版", output: "manga", matchMode: "substring" },
  { token: "漫画絵版", output: "manga", matchMode: "substring" },
  { token: "マンガ背景", output: "manga", matchMode: "substring" },
  { token: "マンガ絵", output: "manga", matchMode: "substring" },
  { token: "manga background", output: "manga", matchMode: "substring" },
  { token: "manga art", output: "manga", matchMode: "substring" },
  { token: "comic background", output: "manga", matchMode: "substring" },
  { token: "comic art", output: "manga", matchMode: "substring" },
  { token: "comic parallel", output: "manga", matchMode: "substring" }
] as const satisfies readonly TextTokenRule<PriceIngestionMarkerCategory>[];

export const CLASSIFIER_ILLUSTRATOR_PREFIX_PATTERNS = [
  /(?:^|[\s([{'"/])illust[:：]\s*([^\s,;|/()]+(?:\s+[^\s,;|/()]+)*)/giu,
  /(?:^|[\s([{'"/])illustration[:：]\s*([^\s,;|/()]+(?:\s+[^\s,;|/()]+)*)/giu,
  /(?:^|[\s([{'"/])イラスト[:：]?\s*([^\s,;|/()]+(?:\s+[^\s,;|/()]+)*)/giu,
  /(?:^|[\s([{'"/])作画[:：]?\s*([^\s,;|/()]+(?:\s+[^\s,;|/()]+)*)/giu
] as const;

export const CLASSIFIER_ALT_ART_MARKER_RULES = [
  { token: "alt art", output: "alt_art", matchMode: "substring" },
  { token: "alternate art", output: "alt_art", matchMode: "substring" },
  { token: "alt-art", output: "alt_art", matchMode: "substring" },
  { token: "alternate illustration", output: "alt_art", matchMode: "substring" },
  { token: "alternate", output: "alt_art", matchMode: "substring" },
  { token: "parallel", output: "alt_art", matchMode: "substring" },
  { token: "パラレル", output: "alt_art", matchMode: "substring" },
  { token: "sec/p", output: "alt_art", matchMode: "substring" },
  { token: "sr/p", output: "alt_art", matchMode: "substring" },
  { token: "sp", output: "alt_art", matchMode: "word" },
  { token: "特別", output: "alt_art", matchMode: "substring" },
  { token: "special", output: "alt_art", matchMode: "substring" }
] as const satisfies readonly TextTokenRule<PriceIngestionMarkerCategory>[];

export const CLASSIFIER_GRADED_MARKER_RULES = [
  { token: "psa", output: "graded", matchMode: "substring" },
  { token: "bgs", output: "graded", matchMode: "substring" },
  { token: "cgc", output: "graded", matchMode: "substring" },
  { token: "ars", output: "graded", matchMode: "substring" },
  { token: "sgc", output: "graded", matchMode: "substring" },
  { token: "鑑定済", output: "graded", matchMode: "substring" },
  { token: "鑑定品", output: "graded", matchMode: "substring" },
  { token: "graded", output: "graded", matchMode: "substring" },
  { token: "grade", output: "graded", matchMode: "substring" }
] as const satisfies readonly TextTokenRule<PriceIngestionMarkerCategory>[];

export const CLASSIFIER_SEALED_MARKER_RULES = [
  { token: "未開封", output: "sealed", matchMode: "substring" },
  { token: "sealed", output: "sealed", matchMode: "word" },
  { token: "seal", output: "sealed", matchMode: "word" },
  { token: "box", output: "sealed", matchMode: "word" },
  { token: "display", output: "sealed", matchMode: "word" },
  { token: "starter deck", output: "sealed", matchMode: "substring" },
  { token: "starterdeck", output: "sealed", matchMode: "substring" },
  { token: "deck", output: "sealed", matchMode: "word" },
  { token: "構築済み", output: "sealed", matchMode: "substring" },
  { token: "デッキ", output: "sealed", matchMode: "substring" },
  { token: "bundle", output: "sealed", matchMode: "substring" },
  { token: "pack", output: "sealed", matchMode: "word" }
] as const satisfies readonly TextTokenRule<PriceIngestionMarkerCategory>[];

export const CLASSIFIER_DECK_PRODUCT_MARKER_RULES = [
  { token: "starter deck", output: "deck_product", matchMode: "substring" },
  { token: "構築済みデッキ", output: "deck_product", matchMode: "substring" },
  { token: "構築済み", output: "deck_product", matchMode: "substring" },
  { token: "デッキ", output: "deck_product", matchMode: "substring" },
  { token: "deck", output: "deck_product", matchMode: "word" },
  { token: "trial deck", output: "deck_product", matchMode: "substring" },
  { token: "intro deck", output: "deck_product", matchMode: "substring" },
  { token: "bundle", output: "deck_product", matchMode: "substring" }
] as const satisfies readonly TextTokenRule<PriceIngestionMarkerCategory>[];

export const CLASSIFIER_PROXY_CUSTOM_MARKER_RULES = [
  { token: "proxy", output: "proxy_custom", matchMode: "substring" },
  { token: "custom", output: "proxy_custom", matchMode: "substring" },
  { token: "custom print", output: "proxy_custom", matchMode: "substring" },
  { token: "custom made", output: "proxy_custom", matchMode: "substring" },
  { token: "fake", output: "proxy_custom", matchMode: "substring" },
  { token: "replica", output: "proxy_custom", matchMode: "substring" },
  { token: "reproduction", output: "proxy_custom", matchMode: "substring" },
  { token: "copy", output: "proxy_custom", matchMode: "word" },
  { token: "代行", output: "proxy_custom", matchMode: "substring" },
  { token: "自作", output: "proxy_custom", matchMode: "substring" },
  { token: "非公式", output: "proxy_custom", matchMode: "substring" },
  { token: "印刷", output: "proxy_custom", matchMode: "substring" },
  { token: "ステッカー", output: "proxy_custom", matchMode: "substring" },
  { token: "シール", output: "proxy_custom", matchMode: "substring" },
  { token: "トークン", output: "proxy_custom", matchMode: "substring" },
  { token: "サンプル", output: "proxy_custom", matchMode: "substring" }
] as const satisfies readonly TextTokenRule<PriceIngestionMarkerCategory>[];

export const CLASSIFIER_CONDITION_MARKER_RULES = [
  { token: "mint", output: "mint", matchMode: "substring" },
  { token: "nm+", output: "mint", matchMode: "substring" },
  { token: "nm", output: "near_mint", matchMode: "substring" },
  { token: "near mint", output: "near_mint", matchMode: "substring" },
  { token: "美品", output: "mint", matchMode: "substring" },
  { token: "状態a-", output: "near_mint", matchMode: "substring" },
  { token: "状態a", output: "mint", matchMode: "substring" },
  { token: "lp", output: "light_play", matchMode: "substring" },
  { token: "light play", output: "light_play", matchMode: "substring" },
  { token: "状態b", output: "moderate_play", matchMode: "substring" },
  { token: "mp", output: "moderate_play", matchMode: "substring" },
  { token: "moderate play", output: "moderate_play", matchMode: "substring" },
  { token: "状態c", output: "damaged", matchMode: "substring" },
  { token: "damaged", output: "damaged", matchMode: "substring" },
  { token: "傷", output: "damaged", matchMode: "substring" },
  { token: "折れ", output: "damaged", matchMode: "substring" },
  { token: "ジャンク", output: "damaged", matchMode: "substring" },
  { token: "graded", output: "graded", matchMode: "substring" },
  { token: "鑑定済", output: "graded", matchMode: "substring" }
] as const satisfies readonly TextTokenRule<PriceIngestionConditionScale>[];

export const NORMALIZE_SOURCE_POLICY_STATUS_RULES = [
  { token: "approved", output: "approved", matchMode: "substring" },
  { token: "allowed", output: "approved", matchMode: "substring" },
  { token: "permitted", output: "approved", matchMode: "substring" },
  { token: "fixture", output: "restricted", matchMode: "substring" },
  { token: "manual only", output: "restricted", matchMode: "substring" },
  { token: "manual", output: "restricted", matchMode: "substring" },
  { token: "sample only", output: "restricted", matchMode: "substring" },
  { token: "blocked", output: "denied", matchMode: "substring" },
  { token: "denied", output: "denied", matchMode: "substring" },
  { token: "prohibited", output: "denied", matchMode: "substring" },
  { token: "forbidden", output: "denied", matchMode: "substring" }
] as const satisfies readonly TextTokenRule<PriceIngestionSourcePolicyStatus>[];

export const NORMALIZE_CONDITION_RULES = [
  {
    label: "graded condition",
    output: "graded",
    pattern: /\b(psa|bgs|cgc|ars|beckett|graded|slabbed)\b|鑑定|grade\s*\d{1,2}/,
    matchMode: "regex"
  },
  {
    label: "damaged condition",
    output: "damaged",
    pattern: /\b(damaged|poor|heavily played|hp|junk|broken)\b|ジャンク|訳あり|傷|折れ|破れ|欠け|水濡れ|状態c/,
    matchMode: "regex"
  },
  {
    label: "moderate play condition",
    output: "moderate_play",
    pattern: /\b(moderate play|mp)\b|状態b|moderately played/,
    matchMode: "regex"
  },
  {
    label: "light play condition",
    output: "light_play",
    pattern: /\b(light play|lp)\b|played|minor scratch|slight/,
    matchMode: "regex"
  },
  {
    label: "near mint condition",
    output: "near_mint",
    pattern: /\b(near mint|nm|nm\/mt|nm-mint)\b|状態a-|ほぼ新品|極美品/,
    matchMode: "regex"
  },
  {
    label: "mint condition",
    output: "mint",
    pattern: /\b(mint|m\/nm|mint condition)\b|新品|未使用|美品|状態a\+|状態a\b/,
    matchMode: "regex"
  }
] as const satisfies readonly RegexRule<PriceIngestionConditionScale>[];

export const NORMALIZE_LISTING_KIND_RULES = [
  {
    label: "proxy/custom listing",
    output: "proxy_custom",
    pattern: /\b(proxy|custom|reproduction|replica|fake|counterfeit|sticker)\b|プロキシ|カスタム|自作|複製|印刷|シール/,
    matchMode: "regex"
  },
  {
    label: "graded listing",
    output: "graded_card",
    pattern: /\b(psa|bgs|cgc|ars|beckett|graded|slabbed)\b|鑑定/,
    matchMode: "regex"
  },
  {
    label: "deck listing",
    output: "deck_product",
    pattern: /\b(deck|starter deck|theme deck|structure deck)\b|デッキ|構築済|スタータ|収録内容/,
    matchMode: "regex"
  },
  {
    label: "sealed listing",
    output: "sealed_product",
    pattern: /\b(seal|sealed|box|pack|booster box)\b|未開封|シュリンク|ブースターボックス|パック/,
    matchMode: "regex"
  }
] as const satisfies readonly RegexRule<PriceIngestionListingKind>[];

export const NORMALIZE_AMBIGUOUS_LISTING_MARKERS = [
  " or ",
  "/",
  "・",
  "／"
] as const;
