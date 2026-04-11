import { getAdminSupabaseClient } from "@/lib/supabase/admin-client";
import type {
  CardRow,
  PriceHistoryRow,
  VariantRow
} from "@/lib/card-detail/types";

export type CardDetailSupabaseClient = ReturnType<typeof getAdminSupabaseClient>;

export function getCardDetailSupabaseClient() {
  return getAdminSupabaseClient();
}

export async function loadVariantsForCard(
  supabase: CardDetailSupabaseClient,
  cardCode: string
) {
  const { data, error } = await supabase
    .from("card_variants")
    .select(
      "id, card_id, variant_type, source_variant_key, variant_rarity, image_url, set_id"
    )
    .eq("card_id", cardCode)
    .order("source_variant_key", { ascending: true });

  if (error) {
    throw new Error(`Failed to load card variants: ${error.message}`);
  }

  return (data as unknown as VariantRow[]) ?? [];
}

export async function loadCardById(
  supabase: CardDetailSupabaseClient,
  cardCode: string
) {
  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, name_en, name_jp, rarity_base, card_type, color, cost, power, counter, text_en, text_jp"
    )
    .eq("id", cardCode)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load card: ${error.message}`);
  }

  return data as CardRow | null;
}

export async function loadPriceHistoryForVariant(
  supabase: CardDetailSupabaseClient,
  variantId: string,
  queryStartIso: string
) {
  const { data, error } = await supabase
    .from("price_history")
    .select("variant_id, source, price_jpy, availability_status, recorded_at")
    .eq("variant_id", variantId)
    .gte("recorded_at", queryStartIso)
    .order("recorded_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load price history: ${error.message}`);
  }

  return (data as PriceHistoryRow[]) ?? [];
}

export async function loadVariantOwnership(
  supabase: CardDetailSupabaseClient,
  variantId: string
) {
  const { data, error } = await supabase
    .from("card_variants")
    .select("id, card_id")
    .eq("id", variantId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to validate requested variant: ${error.message}`);
  }

  return data as Pick<VariantRow, "id" | "card_id"> | null;
}
