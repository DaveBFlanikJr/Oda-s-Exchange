import {
  CARD_DETAIL_BUCKET,
  CARD_DETAIL_LISTING_BASIS,
  CARD_DETAIL_PRICING_BASIS,
  CARD_DETAIL_TIMEZONE,
  CARD_DETAIL_VERSION,
  CARD_DETAIL_WINDOW_DAYS
} from "@/lib/card-detail/constants";
import type { VariantType } from "@/lib/types/cards";
import type { AvailabilityStatus, MarketSourceId } from "@/lib/types/market";

export type SectionStatus = "ready" | "partial" | "empty" | "simulated";
export type ComparisonStatus = "available" | "missing" | "truncated";
export type VariantResolution = "requested" | "defaulted";
export type CardDetailLookupErrorCode =
  | "card_not_found"
  | "variant_not_found_for_card"
  | "variant_belongs_to_different_card";

export type SectionEnvelope<TData, TMeta> = {
  status: SectionStatus;
  data: TData;
  meta: TMeta;
};

export type CardDetailResponse = {
  version: typeof CARD_DETAIL_VERSION;
  request: {
    cardCode: string;
    requestedVariantId: string | null;
    resolvedVariantId: string;
    variantResolution: VariantResolution;
  };
  card: {
    id: string;
    nameEn: string;
    nameJp: string | null;
    rarityBase: string | null;
    cardType: string;
    color: string | null;
    cost: number | null;
    power: number | null;
    counter: number | null;
    textEn: string | null;
    textJp: string | null;
  };
  activeVariant: {
    id: string;
    cardId: string;
    variantType: VariantType;
    sourceVariantKey: string;
    variantRarity: string;
    imageUrl: string | null;
    setId: string;
  };
  variants: Array<{
    id: string;
    variantType: VariantType;
    sourceVariantKey: string;
    variantRarity: string;
    imageUrl: string | null;
    setId: string;
  }>;
  overview: SectionEnvelope<
    {
      lastPriceJpy: number | null;
      change1dPct: number | null;
      range7d: {
        low: number | null;
        high: number | null;
      };
    },
    {
      pricingBasis: typeof CARD_DETAIL_PRICING_BASIS;
      freshnessAt: string | null;
      comparisonStatus: ComparisonStatus;
      truncated: boolean;
      simulated: boolean;
      windowDays: typeof CARD_DETAIL_WINDOW_DAYS;
      latestDay: string | null;
      rangeCoverageDays: number;
      timezone: typeof CARD_DETAIL_TIMEZONE;
    }
  >;
  chart: SectionEnvelope<
    Array<{
      day: string;
      recordedAt: string;
      label: string;
      priceJpy: number;
      source: MarketSourceId;
    }>,
    {
      pricingBasis: typeof CARD_DETAIL_PRICING_BASIS;
      freshnessAt: string | null;
      truncated: boolean;
      simulated: boolean;
      windowDays: typeof CARD_DETAIL_WINDOW_DAYS;
      coverageDays: number;
      timezone: typeof CARD_DETAIL_TIMEZONE;
      bucket: typeof CARD_DETAIL_BUCKET;
    }
  >;
  marketListings: SectionEnvelope<
    Array<{
      source: MarketSourceId;
      condition: string;
      priceJpy: number;
      url: string;
      isBestPrice: boolean;
    }>,
    {
      basis: typeof CARD_DETAIL_LISTING_BASIS;
      freshnessAt: string | null;
      simulated: boolean;
      searchPrecision: "card_level";
      inspectedSources: number;
    }
  >;
};

export type VariantRow = {
  id: string;
  card_id: string;
  variant_type: VariantType;
  source_variant_key: string;
  variant_rarity: string;
  image_url: string | null;
  set_id: string;
};

export type CardRow = {
  id: string;
  name_en: string;
  name_jp: string | null;
  rarity_base: string | null;
  card_type: string;
  color: string | null;
  cost: number | null;
  power: number | null;
  counter: number | null;
  text_en: string | null;
  text_jp: string | null;
};

export type PriceHistoryRow = {
  variant_id: string;
  source: MarketSourceId;
  price_jpy: number | null;
  availability_status: AvailabilityStatus;
  recorded_at: string;
};

export type CardDetailOptions = {
  variantId?: string | null;
};

export type ResolvedVariant = {
  row: VariantRow;
  resolution: VariantResolution;
};

export type DailySeriesPoint = {
  day: string;
  recordedAt: string;
  label: string;
  priceJpy: number;
  source: MarketSourceId;
};
