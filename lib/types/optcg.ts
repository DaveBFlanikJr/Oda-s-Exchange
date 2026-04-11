import type { VariantType } from "@/lib/types/cards";
import type { AvailabilityStatus, MarketSourceId } from "@/lib/types/market";

export interface Card {
  id: string;
  card_set_id: string;
  name_en: string;
  name_jp: string | null;
  card_type: "booster" | "starter" | "promo" | "don";
  rarity_base: string | null;
  attribute: string | null;
  color: string | null;
  cost: number | null;
  power: number | null;
  counter: number | null;
  sub_types: string[];
  text_en: string | null;
  text_jp: string | null;
  created_at: string;
  updated_at: string;
}

export interface CardVariant {
  id: string;
  card_id: string;
  variant_type: VariantType;
  source_record_id: string;
  source_variant_key: string;
  variant_rarity: string;
  set_id: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PriceHistory {
  id: string;
  variant_id: string;
  source: MarketSourceId;
  price_jpy: number | null;
  availability_status: AvailabilityStatus;
  recorded_at: string;
  created_at: string;
}

export interface CreateCard {
  id: string;
  card_set_id: string;
  name_en: string;
  name_jp?: string | null;
  card_type: "booster" | "starter" | "promo" | "don";
  rarity_base?: string | null;
  attribute?: string | null;
  color?: string | null;
  cost?: number | null;
  power?: number | null;
  counter?: number | null;
  sub_types?: string[];
  text_en?: string | null;
  text_jp?: string | null;
}

export interface CreateCardVariant {
  id: string;
  card_id: string;
  variant_type?: VariantType;
  source_record_id: string;
  source_variant_key: string;
  variant_rarity: string;
  set_id: string;
  image_url?: string | null;
  is_active?: boolean;
}

export type CreatePriceHistory =
  | {
      variant_id: string;
      source: MarketSourceId;
      availability_status: "available";
      price_jpy: number;
      recorded_at?: string;
    }
  | {
      variant_id: string;
      source: MarketSourceId;
      availability_status: "sold_out" | "error";
      price_jpy: null;
      recorded_at?: string;
    };
