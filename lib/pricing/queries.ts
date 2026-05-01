import { PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS } from "@/lib/pricing/ingestion/constants";
import { getRequiredPublicSupabaseClient } from "@/lib/supabase/public-client";
import { getServerSupabaseClient } from "@/lib/supabase/server-client";
import type { VariantType } from "@/lib/types/cards";
import type { MarketSourceId } from "@/lib/types/market";

type VariantRow = {
  id: string;
  variant_type: VariantType;
  source_variant_key: string;
};

type CanonicalPriceHistoryRow = {
  variant_id: string;
  source: MarketSourceId;
  price_jpy: number | null;
  availability_status: "available" | null;
  recorded_at: string;
  source_day_jst: string | null;
  canonical_price_point_id: string | null;
};

type CanonicalDailySeriesPoint = {
  day: string;
  recordedAt: string;
  priceJpy: number;
  source: MarketSourceId;
};

type PricingReadSupabaseClient = ReturnType<typeof getServerSupabaseClient>;

export type QualifiedCanonicalPriceHistoryRow = {
  variant_id: string;
  source: MarketSourceId;
  price_jpy: number;
  availability_status: "available";
  recorded_at: string;
  source_day_jst: string;
  canonical_price_point_id: string;
};

export type PublicPriceHistoryPoint = {
  timestamp: string;
  priceJpy: number;
};

export type PublicPriceHistoryResult =
  | {
      status: "not_found";
      cardCode: string;
    }
  | {
      status: "ok";
      cardCode: string;
      resolvedVariantId: string;
      points: PublicPriceHistoryPoint[];
    };

export type CatalogPriceSnapshot = {
  currentPriceJpy: number;
  priceChange24h: number | null;
};

function normalizeCardCode(cardCode: string) {
  return cardCode.trim().toUpperCase();
}

function resolveDefaultVariant(variants: readonly VariantRow[]) {
  return (
    variants.find((variant) => variant.source_variant_key === "STD") ??
    variants.find((variant) => variant.variant_type === "STD") ??
    variants[0] ??
    null
  );
}

function isCanonicalPriceHistoryRow(
  row: CanonicalPriceHistoryRow
): row is QualifiedCanonicalPriceHistoryRow {
  return (
    typeof row.price_jpy === "number" &&
    Number.isFinite(row.price_jpy) &&
    row.availability_status === "available" &&
    row.source_day_jst !== null &&
    row.canonical_price_point_id !== null
  );
}

function selectBestRowForDay(
  currentBest: QualifiedCanonicalPriceHistoryRow,
  candidate: QualifiedCanonicalPriceHistoryRow
) {
  if (candidate.price_jpy < currentBest.price_jpy) {
    return candidate;
  }

  if (candidate.price_jpy > currentBest.price_jpy) {
    return currentBest;
  }

  const candidateRecordedAt = Date.parse(candidate.recorded_at);
  const currentBestRecordedAt = Date.parse(currentBest.recorded_at);

  if (candidateRecordedAt > currentBestRecordedAt) {
    return candidate;
  }

  if (candidateRecordedAt < currentBestRecordedAt) {
    return currentBest;
  }

  return candidate.source.localeCompare(currentBest.source) < 0
    ? candidate
    : currentBest;
}

function shiftIsoDay(day: string, offsetDays: number) {
  const shifted = new Date(`${day}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + offsetDays);

  return shifted.toISOString().slice(0, 10);
}

function findExactPreviousDayPoint(
  series: readonly CanonicalDailySeriesPoint[],
  day: string
) {
  const previousDay = shiftIsoDay(day, -1);

  return series.find((point) => point.day === previousDay) ?? null;
}

function calculatePriceChangePercent(currentPriceJpy: number, previousPriceJpy: number) {
  if (previousPriceJpy <= 0) {
    return null;
  }

  return Number(
    (((currentPriceJpy - previousPriceJpy) / previousPriceJpy) * 100).toFixed(2)
  );
}

async function loadVariantsForCard(
  supabase: PricingReadSupabaseClient,
  normalizedCardCode: string
) {
  const { data: variantData, error: variantError } = await supabase
    .from("card_variants")
    .select("id, variant_type, source_variant_key")
    .eq("card_id", normalizedCardCode)
    .order("source_variant_key", { ascending: true });

  if (variantError) {
    throw new Error(`Failed to load card variants: ${variantError.message}`);
  }

  return (variantData as VariantRow[] | null) ?? [];
}

export async function listQualifiedCanonicalPriceHistoryRows(
  supabase: PricingReadSupabaseClient,
  variantIds: readonly string[],
  options: {
    recordedAtGte?: string;
  } = {}
) {
  if (variantIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("price_history")
    .select(
      "variant_id, source, price_jpy, availability_status, recorded_at, source_day_jst, canonical_price_point_id"
    )
    .in("variant_id", [...variantIds])
    .eq("pricing_basis", PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS)
    .eq("availability_status", "available")
    .not("canonical_price_point_id", "is", null)
    .not("source_day_jst", "is", null)
    .not("price_jpy", "is", null);

  if (options.recordedAtGte) {
    query = query.gte("recorded_at", options.recordedAtGte);
  }

  const { data, error } = await query
    .order("recorded_at", { ascending: true })
    .order("source", { ascending: true });

  if (error) {
    throw new Error(`Failed to load canonical price history: ${error.message}`);
  }

  return ((data as CanonicalPriceHistoryRow[] | null) ?? []).filter(
    isCanonicalPriceHistoryRow
  );
}

function buildCanonicalDailySeries(
  rows: readonly QualifiedCanonicalPriceHistoryRow[]
) {
  const rowsByDay = new Map<string, QualifiedCanonicalPriceHistoryRow[]>();

  for (const row of rows) {
    const dayRows = rowsByDay.get(row.source_day_jst) ?? [];
    dayRows.push(row);
    rowsByDay.set(row.source_day_jst, dayRows);
  }

  return [...rowsByDay.entries()]
    .sort(([leftDay], [rightDay]) => leftDay.localeCompare(rightDay))
    .map(([day, dayRows]) => {
      const bestRow = dayRows.reduce(selectBestRowForDay);

      return {
        day,
        recordedAt: bestRow.recorded_at,
        priceJpy: bestRow.price_jpy,
        source: bestRow.source
      };
    });
}

export async function getPublicPriceHistoryWithSupabase(
  supabase: PricingReadSupabaseClient,
  cardCode: string
): Promise<PublicPriceHistoryResult> {
  const requestCardCode = cardCode.trim();
  const normalizedCardCode = normalizeCardCode(cardCode);
  const variants = await loadVariantsForCard(supabase, normalizedCardCode);
  const activeVariant = resolveDefaultVariant(variants);

  if (!activeVariant) {
    return {
      status: "not_found",
      cardCode: requestCardCode
    };
  }

  const history = await listQualifiedCanonicalPriceHistoryRows(supabase, [activeVariant.id]);

  return {
    status: "ok",
    cardCode: requestCardCode,
    resolvedVariantId: activeVariant.id,
    points: history.map((row) => ({
      timestamp: row.recorded_at,
      priceJpy: row.price_jpy
    }))
  };
}

export async function getPublicPriceHistory(
  cardCode: string
): Promise<PublicPriceHistoryResult> {
  return getPublicPriceHistoryWithSupabase(
    getRequiredPublicSupabaseClient(),
    cardCode
  );
}

export async function getCanonicalCatalogPriceSnapshots(
  supabase: PricingReadSupabaseClient,
  variantIds: readonly string[]
) {
  const snapshots = new Map<string, CatalogPriceSnapshot>();
  const history = await listQualifiedCanonicalPriceHistoryRows(supabase, variantIds);
  const rowsByVariant = new Map<string, QualifiedCanonicalPriceHistoryRow[]>();

  for (const row of history) {
    const variantRows = rowsByVariant.get(row.variant_id) ?? [];
    variantRows.push(row);
    rowsByVariant.set(row.variant_id, variantRows);
  }

  for (const variantId of variantIds) {
    const variantRows = rowsByVariant.get(variantId) ?? [];

    if (variantRows.length === 0) {
      continue;
    }

    const dailySeries = buildCanonicalDailySeries(variantRows);
    const latestPoint = dailySeries.at(-1) ?? null;

    if (!latestPoint) {
      continue;
    }

    const previousDayPoint = findExactPreviousDayPoint(dailySeries, latestPoint.day);

    snapshots.set(variantId, {
      currentPriceJpy: latestPoint.priceJpy,
      priceChange24h: previousDayPoint
        ? calculatePriceChangePercent(latestPoint.priceJpy, previousDayPoint.priceJpy)
        : null
    });
  }

  return snapshots;
}
