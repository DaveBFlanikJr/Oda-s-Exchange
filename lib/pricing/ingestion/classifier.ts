import {
  PRICE_INGESTION_CONDITION_SCALES,
  type PriceIngestionConditionScale,
  type PriceIngestionListingKind
} from "@/lib/pricing/ingestion/constants";
import {
  CLASSIFIER_ALT_ART_MARKER_RULES,
  CLASSIFIER_CONDITION_MARKER_RULES,
  CLASSIFIER_DECK_PRODUCT_MARKER_RULES,
  CLASSIFIER_GRADED_MARKER_RULES,
  CLASSIFIER_ILLUSTRATOR_PREFIX_PATTERNS,
  CLASSIFIER_MANGA_MARKER_RULES,
  CLASSIFIER_PROXY_CUSTOM_MARKER_RULES,
  CLASSIFIER_SEALED_MARKER_RULES,
  matchesTextTokenRule,
  normalizeClassifierSearchText,
  normalizeClassifierText,
  type PriceIngestionMarkerCategory
} from "@/lib/pricing/ingestion/rules";

export type ListingKind = PriceIngestionListingKind;
export type ConditionBucket = PriceIngestionConditionScale;

export const CONFIDENCE_BANDS = ["high", "medium", "low"] as const;

export type ConfidenceBand = (typeof CONFIDENCE_BANDS)[number];

export type MarkerHit = {
  token: string;
  category: PriceIngestionMarkerCategory;
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

const CARD_CODE_PATTERN =
  /(?:^|[^A-Z0-9])([A-Z]{1,4}\s*[-_\/ ]?\s*\d{2}\s*[-_\/ ]?\s*\d{3}[A-Z]?)(?=$|[^A-Z0-9])/gi;

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
  const normalizedText = normalizeClassifierSearchText(text);
  const hits = CLASSIFIER_MANGA_MARKER_RULES
    .filter((rule) => matchesTextTokenRule(normalizedText, rule))
    .map((rule) => rule.token);

  return [...new Set(hits)];
}

export function detectIllustratorMarkers(text: string) {
  const hits = new Set<string>();
  const normalizedText = normalizeClassifierText(text);

  for (const pattern of CLASSIFIER_ILLUSTRATOR_PREFIX_PATTERNS) {
    for (const match of normalizedText.matchAll(pattern)) {
      const token = match[1]?.trim();

      if (token) {
        hits.add(`illust:${token}`);
      }
    }
  }

  return [...hits];
}

export function detectAltArtMarkers(text: string) {
  const normalizedText = normalizeClassifierSearchText(text);
  const hits = new Set<string>();

  for (const rule of CLASSIFIER_ALT_ART_MARKER_RULES) {
    if (matchesTextTokenRule(normalizedText, rule)) {
      hits.add(rule.token);
    }
  }

  return [...hits];
}

export function detectConditionBucket(text: string): {
  bucket: ConditionBucket;
  markers: string[];
} {
  const normalizedText = normalizeClassifierSearchText(text);
  const hits = new Set<string>();
  let bucket: ConditionBucket = "unknown";
  const conditionMarkers = [...CLASSIFIER_CONDITION_MARKER_RULES].sort(
    (left, right) => right.token.length - left.token.length
  );

  for (const marker of conditionMarkers) {
    if (!matchesTextTokenRule(normalizedText, marker)) {
      continue;
    }

    hits.add(marker.token);

    if (bucket === "unknown") {
      bucket = marker.output;
      continue;
    }

    const bucketRank = PRICE_INGESTION_CONDITION_SCALES.indexOf(bucket);
    const nextBucketRank = PRICE_INGESTION_CONDITION_SCALES.indexOf(marker.output);

    if (nextBucketRank > bucketRank) {
      bucket = marker.output;
    }
  }

  return {
    bucket,
    markers: [...hits]
  };
}

function collectMarkers(text: string): MarkerHit[] {
  const normalizedText = normalizeClassifierSearchText(text);
  const markers: MarkerHit[] = [];

  for (const rule of CLASSIFIER_MANGA_MARKER_RULES) {
    if (matchesTextTokenRule(normalizedText, rule)) {
      markers.push({ token: rule.token, category: rule.output });
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

  for (const rule of CLASSIFIER_GRADED_MARKER_RULES) {
    if (matchesTextTokenRule(normalizedText, rule)) {
      markers.push({ token: rule.token, category: rule.output });
    }
  }

  for (const rule of CLASSIFIER_SEALED_MARKER_RULES) {
    if (matchesTextTokenRule(normalizedText, rule)) {
      markers.push({ token: rule.token, category: rule.output });
    }
  }

  for (const rule of CLASSIFIER_DECK_PRODUCT_MARKER_RULES) {
    if (matchesTextTokenRule(normalizedText, rule)) {
      markers.push({ token: rule.token, category: rule.output });
    }
  }

  for (const rule of CLASSIFIER_PROXY_CUSTOM_MARKER_RULES) {
    if (matchesTextTokenRule(normalizedText, rule)) {
      markers.push({ token: rule.token, category: rule.output });
    }
  }

  return markers;
}

function deriveMatchConfidence({
  cardCodes,
  kind,
  markers
}: {
  cardCodes: ParsedCardCode[];
  kind: ListingKind;
  markers: MarkerHit[];
}) {
  const reasons: string[] = [];
  const hasManga = markers.some((marker) => marker.category === "manga");
  const hasIllustrator = markers.some((marker) => marker.category === "illustrator");
  const hasAltArt = markers.some((marker) => marker.category === "alt_art");

  if (cardCodes.length === 0) {
    reasons.push("no normalized card code found for match confidence");
    return {
      confidence: 20,
      confidenceBand: "low" as const,
      reasons
    };
  }

  if (cardCodes.length > 1) {
    reasons.push("multiple normalized card codes reduce match confidence");
    return {
      confidence: 35,
      confidenceBand: "low" as const,
      reasons
    };
  }

  switch (kind) {
    case "proxy_custom":
    case "deck_product":
    case "ambiguous":
      reasons.push(`listing kind ${kind} is not a confident card match`);
      return {
        confidence: 25,
        confidenceBand: "low" as const,
        reasons
      };
    case "graded_card":
      reasons.push("graded card listings stay medium confidence for variant matching");
      return {
        confidence: 60,
        confidenceBand: "medium" as const,
        reasons
      };
    case "sealed_product":
      reasons.push("sealed product listings are not variant-precise matches");
      return {
        confidence: 30,
        confidenceBand: "low" as const,
        reasons
      };
    case "unknown":
      reasons.push("unknown listing kind lowers match confidence");
      return {
        confidence: 30,
        confidenceBand: "low" as const,
        reasons
      };
    case "single_card":
      break;
  }

  if (hasManga) {
    reasons.push("manga markers provide a high-confidence treatment match");
    return {
      confidence: 90,
      confidenceBand: "high" as const,
      reasons
    };
  }

  if (hasAltArt && hasIllustrator) {
    reasons.push("alt-art marker plus illustrator evidence gives a medium-confidence treatment match");
    return {
      confidence: 65,
      confidenceBand: "medium" as const,
      reasons
    };
  }

  if (hasAltArt) {
    reasons.push("alt-art marker without illustrator evidence remains ambiguous");
    return {
      confidence: 40,
      confidenceBand: "low" as const,
      reasons
    };
  }

  reasons.push("single-card listing with one normalized card code and no conflicting treatment markers");
  return {
    confidence: 90,
    confidenceBand: "high" as const,
    reasons
  };
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
  const normalizedText = normalizeClassifierSearchText(text);
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
  const normalizedText = normalizeClassifierText(rawText);
  const cardCodes = extractCardCodes(rawText);
  const normalizedCardCode = cardCodes[0]?.code ?? null;
  const listingKind = classifyListingKind(rawText);
  const condition = detectConditionBucket(rawText);
  const mangaMarkers = detectMangaMarkers(rawText);
  const illustratorMarkers = detectIllustratorMarkers(rawText);
  const altArtMarkers = detectAltArtMarkers(rawText);
  const parseConfidence = scoreConfidence({
    cardCodes,
    kind: listingKind.kind,
    markers: collectMarkers(rawText),
    conditionBucket: condition.bucket
  });
  const matchConfidence = deriveMatchConfidence({
    cardCodes,
    kind: listingKind.kind,
    markers: collectMarkers(rawText)
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
    confidence: matchConfidence.confidence,
    confidenceBand: matchConfidence.confidenceBand,
    reasons: [...new Set([...listingKind.reasons, ...parseConfidence.reasons, ...matchConfidence.reasons])]
  };
}
