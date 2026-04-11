import type { CardSnapshot } from "@/lib/types/price";

const basePoints = [
  { timestamp: "2026-03-10T00:00:00.000Z", priceJpy: 12400 },
  { timestamp: "2026-03-15T00:00:00.000Z", priceJpy: 12880 },
  { timestamp: "2026-03-20T00:00:00.000Z", priceJpy: 13120 },
  { timestamp: "2026-03-25T00:00:00.000Z", priceJpy: 13440 },
  { timestamp: "2026-03-30T00:00:00.000Z", priceJpy: 13780 },
  { timestamp: "2026-04-05T00:00:00.000Z", priceJpy: 14200 }
];

export const defaultCardSnapshot: CardSnapshot = {
  cardCode: "OP13-118",
  cardName: "Monkey.D.Luffy SEC",
  currentPriceJpy: 14200,
  medianPriceJpy: 13940,
  spreadJpy: 1250,
  change24hPercent: 3.48,
  lastUpdatedLabel: "2026-04-06 09:00 JST",
  hasOutlier: false,
  points: basePoints,
  sources: [
    {
      sourceName: "Card Rush",
      sourceType: "retail",
      priceJpy: 14200,
      buyUrl: "https://www.cardrush-op.jp/"
    },
    {
      sourceName: "Yuyu-Tei",
      sourceType: "retail",
      priceJpy: 13980,
      buyUrl: "https://yuyu-tei.jp/"
    },
    {
      sourceName: "Mercari JP",
      sourceType: "p2p",
      priceJpy: null,
      buyUrl: "https://jp.mercari.com/"
    }
  ]
};

export function getMockSnapshotByCardCode(cardCode: string) {
  if (cardCode.toUpperCase() !== defaultCardSnapshot.cardCode) {
    return null;
  }

  return defaultCardSnapshot;
}
