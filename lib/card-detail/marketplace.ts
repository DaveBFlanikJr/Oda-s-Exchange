import { MARKET_SOURCE_IDS, type MarketSourceId } from "@/lib/types/market";
import type { PriceHistoryRow } from "@/lib/card-detail/types";

export function getLatestRowsBySource(history: PriceHistoryRow[]) {
  const latestBySource = new Map<MarketSourceId, PriceHistoryRow>();

  for (const row of history) {
    const existing = latestBySource.get(row.source);

    if (
      !existing ||
      new Date(row.recorded_at).getTime() > new Date(existing.recorded_at).getTime()
    ) {
      latestBySource.set(row.source, row);
    }
  }

  return latestBySource;
}

export function buildMarketListingsFromLatestRows(
  latestRowsBySource: Map<MarketSourceId, PriceHistoryRow>,
  cardId: string
) {
  const rows = MARKET_SOURCE_IDS.flatMap((source) => {
    const latestRow = latestRowsBySource.get(source);

    if (
      !latestRow ||
      latestRow.availability_status !== "available" ||
      latestRow.price_jpy === null
    ) {
      return [];
    }

    return {
      source,
      condition: inferListingCondition(source),
      priceJpy: Math.round(latestRow.price_jpy),
      url: getSourceUrl(source, cardId),
      isBestPrice: false
    };
  });

  return markBestPrice(rows);
}

export function getLatestRowFreshness(
  latestRowsBySource: Map<MarketSourceId, PriceHistoryRow>
) {
  const timestamps = [...latestRowsBySource.values()].map((row) => row.recorded_at);

  if (timestamps.length === 0) {
    return null;
  }

  return timestamps.sort().at(-1) ?? null;
}

function markBestPrice<T extends { priceJpy: number; isBestPrice: boolean }>(rows: T[]) {
  const lowest = rows.length > 0 ? Math.min(...rows.map((row) => row.priceJpy)) : null;

  return rows.map((row) => ({
    ...row,
    isBestPrice: lowest !== null && row.priceJpy === lowest
  }));
}

function inferListingCondition(source: MarketSourceId) {
  if (source === "mercari_jp") {
    return "Lightly Played";
  }

  return "Near Mint";
}

function getSourceUrl(source: MarketSourceId, cardId: string) {
  if (source === "card_rush") {
    return `https://www.cardrush-op.jp/product-list?keyword=${encodeURIComponent(cardId)}`;
  }

  if (source === "yuyu_tei") {
    return `https://yuyu-tei.jp/sell/opc/s/search?search_word=${encodeURIComponent(cardId)}`;
  }

  return `https://jp.mercari.com/search?keyword=${encodeURIComponent(cardId)}`;
}
