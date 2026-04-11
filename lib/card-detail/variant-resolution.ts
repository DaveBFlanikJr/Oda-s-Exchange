import { CardDetailLookupError } from "@/lib/card-detail/errors";
import { loadVariantOwnership, type CardDetailSupabaseClient } from "@/lib/card-detail/repository";
import type {
  ResolvedVariant,
  VariantRow
} from "@/lib/card-detail/types";

export async function resolveActiveVariant(
  supabase: CardDetailSupabaseClient,
  cardCode: string,
  variants: VariantRow[],
  requestedVariantId?: string | null
): Promise<ResolvedVariant> {
  if (requestedVariantId) {
    const matchedVariant = variants.find((variant) => variant.id === requestedVariantId);

    if (matchedVariant) {
      return {
        row: matchedVariant,
        resolution: "requested"
      };
    }

    const variantData = await loadVariantOwnership(supabase, requestedVariantId);

    if (variantData?.id) {
      throw new CardDetailLookupError(
        "variant_belongs_to_different_card",
        `Variant ${requestedVariantId} does not belong to ${cardCode}.`
      );
    }

    throw new CardDetailLookupError(
      "variant_not_found_for_card",
      `Variant ${requestedVariantId} was not found for ${cardCode}.`
    );
  }

  return {
    row:
      variants.find((variant) => variant.source_variant_key === "STD") ??
      variants.find((variant) => variant.variant_type === "STD") ??
      variants[0],
    resolution: "defaulted"
  };
}
