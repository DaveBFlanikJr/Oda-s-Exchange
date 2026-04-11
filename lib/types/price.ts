import type { SourceType } from "@/lib/types/market";

export type PricePoint = {
  timestamp: string;
  priceJpy: number;
};

export type SourceSnapshot = {
  sourceName: string;
  sourceType: SourceType;
  priceJpy: number | null;
  buyUrl: string;
};

export type CardSnapshot = {
  cardCode: string;
  cardName: string;
  currentPriceJpy: number;
  medianPriceJpy: number;
  spreadJpy: number;
  change24hPercent: number;
  lastUpdatedLabel: string;
  hasOutlier: boolean;
  points: PricePoint[];
  sources: SourceSnapshot[];
};
