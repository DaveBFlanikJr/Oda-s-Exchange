import {
  CARD_DETAIL_BUCKET,
  CARD_DETAIL_LISTING_BASIS,
  CARD_DETAIL_PRICING_BASIS,
  CARD_DETAIL_TIMEZONE,
  CARD_DETAIL_VERSION,
  CARD_DETAIL_WINDOW_DAYS
} from "@/lib/card-detail/constants";
import {
  buildMarketListingsFromLatestRows,
  getLatestRowFreshness,
  getLatestRowsBySource
} from "@/lib/card-detail/marketplace";
import {
  getCardDetailSupabaseClient,
  loadCardById,
  loadCanonicalPriceHistoryForVariant,
  loadPriceHistoryForVariant,
  loadVariantsForCard
} from "@/lib/card-detail/repository";
import {
  buildDailySeries,
  deriveChartStatus,
  deriveComparisonStatus,
  deriveOverviewStatus,
  findExactPreviousDayPoint,
  getWindowPoints
} from "@/lib/card-detail/series";
import { getRecentJstWindowStartIso } from "@/lib/card-detail/time";
import type { CardDetailOptions, CardDetailResponse } from "@/lib/card-detail/types";
import { resolveActiveVariant } from "@/lib/card-detail/variant-resolution";

export { CardDetailLookupError, isCardDetailLookupError } from "@/lib/card-detail/errors";
export type { CardDetailResponse } from "@/lib/card-detail/types";

export async function getCardDetail(
  cardCode: string,
  options: CardDetailOptions = {}
): Promise<CardDetailResponse | null> {
  return getCardDetailWithSupabase(
    getCardDetailSupabaseClient(),
    cardCode,
    options
  );
}

export async function getCardDetailWithSupabase(
  supabase: ReturnType<typeof getCardDetailSupabaseClient>,
  cardCode: string,
  options: CardDetailOptions = {}
): Promise<CardDetailResponse | null> {
  const normalizedCardCode = cardCode.trim().toUpperCase();
  const variants = await loadVariantsForCard(supabase, normalizedCardCode);

  if (variants.length === 0) {
    return null;
  }
  const card = await loadCardById(supabase, normalizedCardCode);

  if (!card) {
    return null;
  }

  const resolvedVariant = await resolveActiveVariant(
    supabase,
    normalizedCardCode,
    variants,
    options.variantId
  );
  const queryStartIso = getRecentJstWindowStartIso(CARD_DETAIL_WINDOW_DAYS);
  const [rawHistory, canonicalHistory] = await Promise.all([
    loadPriceHistoryForVariant(supabase, resolvedVariant.row.id, queryStartIso),
    loadCanonicalPriceHistoryForVariant(supabase, resolvedVariant.row.id, queryStartIso)
  ]);
  const dailySeries = buildDailySeries(canonicalHistory);
  const chartStatus = deriveChartStatus(dailySeries, rawHistory);
  const chartFreshnessAt = dailySeries.at(-1)?.recordedAt ?? null;
  const chart = {
    status: chartStatus,
    data: dailySeries,
    meta: {
      pricingBasis: CARD_DETAIL_PRICING_BASIS,
      freshnessAt: chartFreshnessAt,
      truncated: false,
      simulated: false,
      windowDays: CARD_DETAIL_WINDOW_DAYS,
      coverageDays: dailySeries.length,
      timezone: CARD_DETAIL_TIMEZONE,
      bucket: CARD_DETAIL_BUCKET
    }
  } satisfies CardDetailResponse["chart"];
  const latestRowsBySource = getLatestRowsBySource(rawHistory);
  const marketListingsData = buildMarketListingsFromLatestRows(latestRowsBySource, resolvedVariant.row.card_id);
  const marketListings = {
    status: marketListingsData.length > 0 ? "ready" : "empty",
    data: marketListingsData,
    meta: {
      basis: CARD_DETAIL_LISTING_BASIS,
      freshnessAt: getLatestRowFreshness(latestRowsBySource),
      simulated: false,
      searchPrecision: "card_level" as const,
      inspectedSources: latestRowsBySource.size
    }
  } satisfies CardDetailResponse["marketListings"];
  const latestPoint = dailySeries.at(-1) ?? null;
  const previousDayPoint = latestPoint ? findExactPreviousDayPoint(dailySeries, latestPoint.day) : null;
  const rangeWindowPoints = latestPoint ? getWindowPoints(dailySeries, latestPoint.day, 7) : [];
  const overviewData = {
    lastPriceJpy: latestPoint?.priceJpy ?? null,
    change1dPct:
      latestPoint && previousDayPoint
        ? Number(
            (
              ((latestPoint.priceJpy - previousDayPoint.priceJpy) / previousDayPoint.priceJpy) *
              100
            ).toFixed(2)
          )
        : null,
    range7d: {
      low: rangeWindowPoints.length > 0 ? Math.min(...rangeWindowPoints.map((point) => point.priceJpy)) : null,
      high: rangeWindowPoints.length > 0 ? Math.max(...rangeWindowPoints.map((point) => point.priceJpy)) : null
    }
  };
  const overview = {
    status: deriveOverviewStatus(latestPoint, previousDayPoint, rangeWindowPoints, chartStatus),
    data: overviewData,
    meta: {
      pricingBasis: CARD_DETAIL_PRICING_BASIS,
      freshnessAt: latestPoint?.recordedAt ?? null,
      comparisonStatus: deriveComparisonStatus(latestPoint, previousDayPoint),
      truncated: false,
      simulated: false,
      windowDays: CARD_DETAIL_WINDOW_DAYS,
      latestDay: latestPoint?.day ?? null,
      rangeCoverageDays: rangeWindowPoints.length,
      timezone: CARD_DETAIL_TIMEZONE
    }
  } satisfies CardDetailResponse["overview"];

  return {
    version: CARD_DETAIL_VERSION,
    request: {
      cardCode: normalizedCardCode,
      requestedVariantId: options.variantId ?? null,
      resolvedVariantId: resolvedVariant.row.id,
      variantResolution: resolvedVariant.resolution
    },
    card: {
      id: card.id,
      nameEn: card.name_en,
      nameJp: card.name_jp,
      rarityBase: card.rarity_base,
      cardType: card.card_type,
      color: card.color,
      cost: card.cost,
      power: card.power,
      counter: card.counter,
      textEn: card.text_en,
      textJp: card.text_jp
    },
    activeVariant: {
      id: resolvedVariant.row.id,
      cardId: resolvedVariant.row.card_id,
      variantType: resolvedVariant.row.variant_type,
      sourceVariantKey: resolvedVariant.row.source_variant_key,
      variantRarity: resolvedVariant.row.variant_rarity,
      imageUrl: resolvedVariant.row.image_url,
      setId: resolvedVariant.row.set_id
    },
    variants: variants.map((variant) => ({
      id: variant.id,
      variantType: variant.variant_type,
      sourceVariantKey: variant.source_variant_key,
      variantRarity: variant.variant_rarity,
      imageUrl: variant.image_url,
      setId: variant.set_id
    })),
    overview,
    chart,
    marketListings
  };
}
