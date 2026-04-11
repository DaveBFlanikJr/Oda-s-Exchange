import { getRequiredPublicSupabaseClient } from "@/lib/supabase/public-client";
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

type PriceHistoryRow = {
  variant_id: string;
  price_jpy: number | null;
  recorded_at: string;
};

type CatalogSupabaseClient = ReturnType<typeof getRequiredPublicSupabaseClient>;

export async function getCatalogItems(limit = 2500) {
  const supabase = getRequiredPublicSupabaseClient();

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
  const snapshots = new Map<
    string,
    { currentPriceJpy: number; priceChange24h: number | null }
  >();
  const variantIds = variants.map((variant) => variant.id);

  if (variantIds.length === 0) {
    return snapshots;
  }

  const { data, error } = await supabase
    .from("price_history")
    .select("variant_id, price_jpy, recorded_at")
    .in("variant_id", variantIds)
    .order("recorded_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load catalog prices: ${error.message}`);
  }

  const priceRows = (data as PriceHistoryRow[]) ?? [];
  const rowsByVariant = new Map<string, PriceHistoryRow[]>();
  const variantsByCardId = new Map<string, VariantRow[]>();

  for (const row of priceRows) {
    const rows = rowsByVariant.get(row.variant_id) ?? [];
    rows.push(row);
    rowsByVariant.set(row.variant_id, rows);
  }

  for (const variant of variants) {
    const siblingVariants = variantsByCardId.get(variant.card_id) ?? [];
    siblingVariants.push(variant);
    variantsByCardId.set(variant.card_id, siblingVariants);
  }

  for (const variant of variants) {
    const ownRows = (rowsByVariant.get(variant.id) ?? []).filter(
      (row): row is PriceHistoryRow & { price_jpy: number } => row.price_jpy !== null
    );
    const siblingRows = (variantsByCardId.get(variant.card_id) ?? [])
      .flatMap((sibling) => rowsByVariant.get(sibling.id) ?? [])
      .filter(
        (row): row is PriceHistoryRow & { price_jpy: number } => row.price_jpy !== null
      )
      .sort(
        (left, right) =>
          new Date(right.recorded_at).getTime() - new Date(left.recorded_at).getTime()
      );
    const availableRows = ownRows.length > 0 ? ownRows : siblingRows;

    if (availableRows.length === 0) {
      continue;
    }

    const currentPriceJpy = availableRows[0].price_jpy;
    const previousPriceJpy = availableRows[1]?.price_jpy ?? null;
    const priceChange24h =
      previousPriceJpy && previousPriceJpy > 0
        ? Number((((currentPriceJpy - previousPriceJpy) / previousPriceJpy) * 100).toFixed(2))
        : null;

    snapshots.set(variant.id, {
      currentPriceJpy,
      priceChange24h
    });
  }

  return snapshots;
}
