import {
  SCRAPER_PROVIDER_TO_MARKET_SOURCE_ID,
  type MarketSourceId,
  type ScraperProviderCode,
  type SourceType
} from "@/lib/types/market";

export type SourceConfig = {
  code: ScraperProviderCode;
  marketSourceId: MarketSourceId;
  displayName: string;
  sourceType: SourceType;
  listingUrl: string;
  mode: "playwright" | "axios-cheerio";
};

export const sourceConfigs: SourceConfig[] = [
  {
    code: "card-rush",
    marketSourceId: SCRAPER_PROVIDER_TO_MARKET_SOURCE_ID["card-rush"],
    displayName: "Card Rush",
    sourceType: "retail",
    listingUrl: "https://www.cardrush-op.jp/",
    mode: "playwright"
  },
  {
    code: "yuyu-tei",
    marketSourceId: SCRAPER_PROVIDER_TO_MARKET_SOURCE_ID["yuyu-tei"],
    displayName: "Yuyu-Tei",
    sourceType: "retail",
    listingUrl: "https://yuyu-tei.jp/",
    mode: "axios-cheerio"
  },
  {
    code: "mercari-jp",
    marketSourceId: SCRAPER_PROVIDER_TO_MARKET_SOURCE_ID["mercari-jp"],
    displayName: "Mercari JP",
    sourceType: "p2p",
    listingUrl: "https://jp.mercari.com/",
    mode: "playwright"
  }
];
