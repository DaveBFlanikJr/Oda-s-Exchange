export const CARD_DETAIL_VERSION = "card-detail.v2" as const;
export const CARD_DETAIL_TIMEZONE = "Asia/Tokyo" as const;
export const CARD_DETAIL_BUCKET = "day" as const;
export const CARD_DETAIL_LEGACY_PRICE_HISTORY_BASIS = "daily_best_available_jst" as const;
export const CARD_DETAIL_PRICING_BASIS = CARD_DETAIL_LEGACY_PRICE_HISTORY_BASIS;
export const CARD_DETAIL_LISTING_BASIS =
  "latest_row_currently_available_by_source" as const;
export const CARD_DETAIL_WINDOW_DAYS = 35 as const;
export const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
