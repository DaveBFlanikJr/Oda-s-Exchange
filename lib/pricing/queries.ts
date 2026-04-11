import { defaultCardSnapshot } from "@/lib/pricing/mock-data";
import { getPublicSupabaseClient } from "@/lib/supabase/public-client";
import type { VariantType } from "@/lib/types/cards";

type VariantRow = {
  id: string;
  variant_type: VariantType;
  source_variant_key: string;
};

export async function getPublicPriceHistory(cardCode: string) {
  const supabase = getPublicSupabaseClient();

  if (!supabase) {
    return defaultCardSnapshot.points;
  }

  const { data: variantData, error: variantError } = await supabase
    .from("card_variants")
    .select("id, variant_type, source_variant_key")
    .eq("card_id", cardCode.toUpperCase())
    .order("source_variant_key", { ascending: true });

  if (variantError) {
    throw new Error(`Failed to load card variants: ${variantError.message}`);
  }

  const variants = (variantData as VariantRow[]) ?? [];
  const activeVariant =
    variants.find((variant) => variant.source_variant_key === "STD") ??
    variants.find((variant) => variant.variant_type === "STD") ??
    variants[0];

  if (!activeVariant) {
    return [];
  }

  const { data, error } = await supabase
    .from("price_history")
    .select("price_jpy, recorded_at")
    .eq("variant_id", activeVariant.id)
    .order("recorded_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load price history: ${error.message}`);
  }

  return data.map((row) => ({
    timestamp: row.recorded_at,
    priceJpy: row.price_jpy
  }));
}
