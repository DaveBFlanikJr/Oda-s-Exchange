import { getServerSupabaseClient } from "@/lib/supabase/server-client";
import { getCanonicalCatalogPriceSnapshots } from "@/lib/pricing/queries";
import type { VariantType } from "@/lib/types/cards";

export type CatalogItem = {
  id: string;
  cardId: string;
  cardName: string;
  rarity: string | null;
  variantType: VariantType;
  sourceVariantKey: string;
  imageUrl: string | null;
  currentPriceJpy: number | null;
  priceChange24h: number | null;
  createdAt: string;
};

type VariantRow = {
  id: string;
  card_id: string;
  variant_type: VariantType;
  source_variant_key: string;
  image_url: string | null;
  created_at: string;
  cards:
    | {
        name_en: string;
        rarity_base: string | null;
      }
    | Array<{
        name_en: string;
        rarity_base: string | null;
      }>
    | null;
};

type CatalogSupabaseClient = ReturnType<typeof getServerSupabaseClient>;

export async function getCatalogItems(limit = 2500) {
  const supabase = getServerSupabaseClient();

  const { data, error } = await supabase
    .from("card_variants")
    .select(
      `
        id,
        card_id,
        variant_type,
        source_variant_key,
        image_url,
        created_at,
        cards (
          name_en,
          rarity_base
        )
      `
    )
    .order("card_id", { ascending: true })
    .order("source_variant_key", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load catalog items: ${error.message}`);
  }

  const variants = (data as unknown as VariantRow[]) ?? [];
  const priceSnapshots = await getCatalogPriceSnapshots(
    supabase,
    variants
  );

  return variants.map((row) => {
    const snapshot = priceSnapshots.get(row.id);
    const card = getJoinedCard(row.cards);

    return {
      id: row.id,
      cardId: row.card_id,
      cardName: card?.name_en ?? row.card_id,
      rarity: normalizeRarity(card?.rarity_base ?? null),
      variantType: row.variant_type,
      sourceVariantKey: row.source_variant_key,
      imageUrl: row.image_url,
      currentPriceJpy: snapshot?.currentPriceJpy ?? null,
      priceChange24h: snapshot?.priceChange24h ?? null,
      createdAt: row.created_at
    };
  });
}

function getJoinedCard(cards: VariantRow["cards"]) {
  if (!cards) {
    return null;
  }

  return Array.isArray(cards) ? (cards[0] ?? null) : cards;
}

function normalizeRarity(rarity: string | null) {
  if (!rarity) {
    return null;
  }

  const compact = rarity.toUpperCase().replace(/\s+/g, "");

  if (compact.includes("SECRETRARE")) {
    return "SEC";
  }

  if (compact.includes("SUPERRARE")) {
    return "SR";
  }

  if (compact === "UNCOMMON" || compact === "UC") {
    return "UC";
  }

  if (compact === "COMMON" || compact === "C") {
    return "C";
  }

  if (compact === "RARE" || compact === "R") {
    return "R";
  }

  if (compact === "LEADER" || compact === "L") {
    return "L";
  }

  return compact;
}

async function getCatalogPriceSnapshots(
  supabase: CatalogSupabaseClient,
  variants: VariantRow[]
) {
  const variantIds = variants.map((variant) => variant.id);

  if (variantIds.length === 0) {
    return new Map<string, { currentPriceJpy: number; priceChange24h: number | null }>();
  }

  return getCanonicalCatalogPriceSnapshots(supabase, variantIds);
}
