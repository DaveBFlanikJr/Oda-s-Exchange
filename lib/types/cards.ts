export const VARIANT_TYPES = ["STD", "AA", "M", "SP", "TR", "S", "DON"] as const;

export type VariantType = (typeof VARIANT_TYPES)[number];
