import {
  PRICE_INGESTION_CONDITION_SCALES,
  type PriceIngestionConditionScale,
  type PriceIngestionListingKind
} from "@/lib/pricing/ingestion/constants";

export type ListingKind = PriceIngestionListingKind;
export type ConditionBucket = PriceIngestionConditionScale;

export const CONFIDENCE_BANDS = ["high", "medium", "low"] as const;

export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export type MarkerHit = {
  token: string;
  category:
    | "manga"
    | "illustrator"
    | "alt_art"
    | "condition"
    | "graded"
    | "sealed"
    | "deck_product"
    | "proxy_custom";
};

export type ListingKindClassification = {
  kind: ListingKind;
  confidence: number;
  confidenceBand: ConfidenceBand;
  reasons: string[];
  markers: MarkerHit[];
};

export type ParsedCardCode = {
  code: string;
  raw: string;
};

export type ListingParseInput = {
  text?: string | null;
  title?: string | null;
  condition?: string | null;
  priceText?: string | null;
  sourceUrl?: string | null;
};

export type ListingParseSummary = {
  rawText: string;
  normalizedText: string;
  normalizedCardCode: string | null;
  cardCodes: ParsedCardCode[];
  listingKind: ListingKind;
  listingKindConfidence: number;
  listingKindConfidenceBand: ConfidenceBand;
  conditionBucket: ConditionBucket;
  mangaMarkers: string[];
  illustratorMarkers: string[];
  altArtMarkers: string[];
  confidence: number;
  confidenceBand: ConfidenceBand;
  reasons: string[];
};

const MANGA_MARKERS = [
  "漫画背景",
  "漫画絵",
  "コミックパラレル",
  "コミパラ",
  "漫画背景版",
  "漫画絵版",
  "マンガ背景",
  "マンガ絵",
  "manga background",
  "manga art",
  "comic background",
  "comic art",
  "comic parallel"
] as const;

const ILLUSTRATOR_PREFIXES = [
  /(?:^|[\s([{'"/])illust[:：]\s*([^\s,;|/()]+(?:\s+[^\s,;|/()]+)*)/giu,
  /(?:^|[\s([{'"/])illustration[:：]\s*([^\s,;|/()]+(?:\s+[^\s,;|/()]+)*)/giu,
  /(?:^|[\s([{'"/])イラスト[:：]?\s*([^\s,;|/()]+(?:\s+[^\s,;|/()]+)*)/giu,
  /(?:^|[\s([{'"/])作画[:：]?\s*([^\s,;|/()]+(?:\s+[^\s,;|/()]+)*)/giu
];

const ALT_ART_MARKERS = [
  "alt art",
  "alternate art",
  "alt-art",
  "alternate illustration",
  "alternate",
  "parallel",
  "パラレル",
  "sec/p",
  "sr/p",
  "sp",
  "特別",
  "special"
] as const;

const GRADED_MARKERS = [
  "psa",
  "bgs",
  "cgc",
  "ars",
  "sgc",
  "鑑定済",
  "鑑定品",
  "graded",
  "grade"
] as const;

const SEALED_MARKERS = [
  "未開封",
  "sealed",
  "seal",
  "box",
  "starter deck",
  "starterdeck",
  "deck",
  "構築済み",
  "デッキ",
  "bundle",
  "pack"
] as const;

const DECK_PRODUCT_MARKERS = [
  "starter deck",
  "構築済みデッキ",
  "構築済み",
  "デッキ",
  "deck",
  "trial deck",
  "intro deck",
  "bundle",
  "box",
  "display"
] as const;

const PROXY_CUSTOM_MARKERS = [
  "proxy",
  "custom",
  "custom print",
  "custom made",
  "fake",
  "replica",
  "reproduction",
  "copy",
  "reprint",
  "代行",
  "自作",
  "非公式",
  "印刷",
  "ステッカー",
  "シール",
  "トークン",
  "サンプル"
] as const;

const CONDITION_MARKERS = [
  { token: "mint", bucket: "mint" as const },
  { token: "nm+", bucket: "mint" as const },
  { token: "nm", bucket: "near_mint" as const },
  { token: "near mint", bucket: "near_mint" as const },
  { token: "美品", bucket: "near_mint" as const },
  { token: "状態a-", bucket: "near_mint" as const },
  { token: "状態a", bucket: "mint" as const },
  { token: "lp", bucket: "light_play" as const },
  { token: "light play", bucket: "light_play" as const },
  { token: "状態b", bucket: "moderate_play" as const },
  { token: "mp", bucket: "moderate_play" as const },
  { token: "moderate play", bucket: "moderate_play" as const },
  { token: "状態c", bucket: "damaged" as const },
  { token: "damaged", bucket: "damaged" as const },
  { token: "傷", bucket: "damaged" as const },
  { token: "折れ", bucket: "damaged" as const },
  { token: "ジャンク", bucket: "damaged" as const },
  { token: "graded", bucket: "graded" as const },
  { token: "鑑定済", bucket: "graded" as const }
] as const;

const CARD_CODE_PATTERN =
  /(?:^|[^A-Z0-9])([A-Z]{1,4}\s*[-_\/ ]?\s*\d{2}\s*[-_\/ ]?\s*\d{3}[A-Z]?)(?=$|[^A-Z0-9])/gi;

function normalizeText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchText(value: string) {
  return normalizeText(value).toLowerCase();
}

function normalizeCardCodeToken(raw: string) {
  const stripped = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = stripped.match(/^([A-Z]{1,4})(\d{2})(\d{3}[A-Z]?)$/);

  if (!match) {
    return null;
  }

  return `${match[1]}${match[2]}-${match[3]}`;
}

export function extractCardCodes(text: string) {
  const codes = new Map<string, ParsedCardCode>();

  for (const match of text.matchAll(CARD_CODE_PATTERN)) {
    const raw = match[1]?.trim();

    if (!raw) {
      continue;
    }

    const code = normalizeCardCodeToken(raw);

    if (!code || codes.has(code)) {
      continue;
    }

    codes.set(code, { code, raw });
  }

  return [...codes.values()];
}

export function normalizeCardCodeFromText(text: string) {
  return extractCardCodes(text)[0]?.code ?? null;
}

export function detectMangaMarkers(text: string) {
  const normalizedText = normalizeSearchText(text);
  const hits = MANGA_MARKERS.filter((marker) => normalizedText.includes(marker.toLowerCase()));

  return [...new Set(hits)];
}

export function detectIllustratorMarkers(text: string) {
  const hits = new Set<string>();
  const normalizedText = normalizeText(text);

  for (const pattern of ILLUSTRATOR_PREFIXES) {
    for (const match of normalizedText.matchAll(pattern)) {
      const token = match[2]?.trim();

      if (token) {
        hits.add(`illust:${token}`);
      }
    }
  }

  return [...hits];
}

export function detectAltArtMarkers(text: string) {
  const normalizedText = normalizeSearchText(text);
  const hits = new Set<string>();

  for (const marker of ALT_ART_MARKERS) {
    if (normalizedText.includes(marker)) {
      hits.add(marker);
    }
  }

  return [...hits];
}

export function detectConditionBucket(text: string): {
  bucket: ConditionBucket;
  markers: string[];
} {
  const normalizedText = normalizeSearchText(text);
  const hits = new Set<string>();
  let bucket: ConditionBucket = "unknown";
  const conditionMarkers = [...CONDITION_MARKERS].sort(
    (left, right) => right.token.length - left.token.length
  );

  for (const marker of conditionMarkers) {
    if (!normalizedText.includes(marker.token.toLowerCase())) {
      continue;
    }

    hits.add(marker.token);

    if (bucket === "unknown") {
      bucket = marker.bucket;
      continue;
    }

    const bucketRank = PRICE_INGESTION_CONDITION_SCALES.indexOf(bucket);
    const nextBucketRank = PRICE_INGESTION_CONDITION_SCALES.indexOf(marker.bucket);

    if (nextBucketRank > bucketRank) {
      bucket = marker.bucket;
    }
  }

  return {
    bucket,
    markers: [...hits]
  };
}

function collectMarkers(text: string): MarkerHit[] {
  const normalizedText = normalizeSearchText(text);
  const markers: MarkerHit[] = [];

  for (const marker of MANGA_MARKERS) {
    if (normalizedText.includes(marker.toLowerCase())) {
      markers.push({ token: marker, category: "manga" });
    }
  }

  for (const marker of detectIllustratorMarkers(text)) {
    markers.push({ token: marker, category: "illustrator" });
  }

  for (const marker of detectAltArtMarkers(text)) {
    markers.push({ token: marker, category: "alt_art" });
  }

  const condition = detectConditionBucket(text);
  for (const marker of condition.markers) {
    markers.push({ token: marker, category: "condition" });
  }

  for (const marker of GRADED_MARKERS) {
    if (normalizedText.includes(marker.toLowerCase())) {
      markers.push({ token: marker, category: "graded" });
    }
  }

  for (const marker of SEALED_MARKERS) {
    if (normalizedText.includes(marker.toLowerCase())) {
      markers.push({ token: marker, category: "sealed" });
    }
  }

  for (const marker of DECK_PRODUCT_MARKERS) {
    if (normalizedText.includes(marker.toLowerCase())) {
      markers.push({ token: marker, category: "deck_product" });
    }
  }

  for (const marker of PROXY_CUSTOM_MARKERS) {
    if (normalizedText.includes(marker.toLowerCase())) {
      markers.push({ token: marker, category: "proxy_custom" });
    }
  }

  return markers;
}

function scoreConfidence({
  cardCodes,
  kind,
  markers,
  conditionBucket
}: {
  cardCodes: ParsedCardCode[];
  kind: ListingKind;
  markers: MarkerHit[];
  conditionBucket: ConditionBucket;
}) {
  let score = 0;
  const reasons: string[] = [];

  if (cardCodes.length > 0) {
    score += 60;
    reasons.push(`found ${cardCodes.length} normalized card code${cardCodes.length === 1 ? "" : "s"}`);
  } else {
    reasons.push("no normalized card code found");
  }

  const hasManga = markers.some((marker) => marker.category === "manga");
  const hasIllustrator = markers.some((marker) => marker.category === "illustrator");
  const hasAltArt = markers.some((marker) => marker.category === "alt_art");

  if (hasManga) {
    score += 15;
    reasons.push("manga marker detected");
  }

  if (hasIllustrator) {
    score += 12;
    reasons.push("illustrator marker detected");
  }

  if (hasAltArt) {
    score += 10;
    reasons.push("alt-art marker detected");
  }

  if (conditionBucket !== "unknown") {
    score += 5;
    reasons.push(`condition bucket detected: ${conditionBucket}`);
  }

  switch (kind) {
    case "single_card":
      score += 10;
      reasons.push("listing kind is single_card");
      break;
    case "graded_card":
    case "sealed_product":
      score -= 5;
      reasons.push(`listing kind is ${kind}`);
      break;
    case "deck_product":
      score -= 20;
      reasons.push("listing kind is deck_product");
      break;
    case "proxy_custom":
      score -= 30;
      reasons.push("listing kind is proxy_custom");
      break;
    case "ambiguous":
      score -= 35;
      reasons.push("listing kind is ambiguous");
      break;
    case "unknown":
      score -= 10;
      reasons.push("listing kind is unknown");
      break;
  }

  if (cardCodes.length > 1) {
    score -= 15;
    reasons.push("multiple card codes detected");
  }

  if (score < 0) {
    score = 0;
  }

  if (score > 100) {
    score = 100;
  }

  const confidenceBand: ConfidenceBand =
    score >= 80 ? "high" : score >= 55 ? "medium" : "low";

  return {
    confidence: score,
    confidenceBand,
    reasons
  };
}

export function classifyListingKind(text: string): ListingKindClassification {
  const normalizedText = normalizeSearchText(text);
  const markers = collectMarkers(text);
  const hasGraded = markers.some((marker) => marker.category === "graded");
  const hasSealed = markers.some((marker) => marker.category === "sealed");
  const hasDeckProduct = markers.some((marker) => marker.category === "deck_product");
  const hasProxyCustom = markers.some((marker) => marker.category === "proxy_custom");

  let kind: ListingKind = "single_card";
  const reasons: string[] = [];

  if (!normalizedText || !extractCardCodes(text).length) {
    kind = "ambiguous";
    reasons.push("missing normalized card code or listing text");
  } else if (hasProxyCustom) {
    kind = "proxy_custom";
    reasons.push("matched listing kind: proxy_custom");
  } else if (hasDeckProduct) {
    kind = "deck_product";
    reasons.push("matched listing kind: deck_product");
  } else if (hasGraded) {
    kind = "graded_card";
    reasons.push("matched listing kind: graded_card");
  } else if (hasSealed) {
    kind = "sealed_product";
    reasons.push("matched listing kind: sealed_product");
  } else {
    reasons.push("no strong non-normal listing markers detected");
  }

  if (kind === "single_card") {
    const hasManga = markers.some((marker) => marker.category === "manga");
    const hasIllustrator = markers.some((marker) => marker.category === "illustrator");
    const hasAltArt = markers.some((marker) => marker.category === "alt_art");

    if (!hasManga && !hasIllustrator && !hasAltArt) {
      reasons.push("no treatment markers detected");
    }
  }

  const score = scoreConfidence({
    cardCodes: extractCardCodes(text),
    kind,
    markers,
    conditionBucket: detectConditionBucket(text).bucket
  });

  return {
    kind,
    confidence: score.confidence,
    confidenceBand: score.confidenceBand,
    reasons: [...reasons, ...score.reasons],
    markers
  };
}

export function summarizeListingParse(input: ListingParseInput): ListingParseSummary {
  const parts = [input.title, input.condition, input.priceText, input.text]
    .filter((part): part is string => Boolean(part && part.trim()));
  const rawText = parts.join("\n");
  const normalizedText = normalizeText(rawText);
  const cardCodes = extractCardCodes(rawText);
  const normalizedCardCode = cardCodes[0]?.code ?? null;
  const listingKind = classifyListingKind(rawText);
  const condition = detectConditionBucket(rawText);
  const mangaMarkers = detectMangaMarkers(rawText);
  const illustratorMarkers = detectIllustratorMarkers(rawText);
  const altArtMarkers = detectAltArtMarkers(rawText);
  const confidence = scoreConfidence({
    cardCodes,
    kind: listingKind.kind,
    markers: collectMarkers(rawText),
    conditionBucket: condition.bucket
  });

  return {
    rawText,
    normalizedText,
    normalizedCardCode,
    cardCodes,
    listingKind: listingKind.kind,
    listingKindConfidence: listingKind.confidence,
    listingKindConfidenceBand: listingKind.confidenceBand,
    conditionBucket: condition.bucket,
    mangaMarkers,
    illustratorMarkers,
    altArtMarkers,
    confidence: confidence.confidence,
    confidenceBand: confidence.confidenceBand,
    reasons: [...new Set([...listingKind.reasons, ...confidence.reasons])]
  };
}
