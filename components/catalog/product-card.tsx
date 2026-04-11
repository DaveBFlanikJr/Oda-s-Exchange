"use client";

import Image from "next/image";
import Link from "next/link";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatJPY } from "@/lib/pricing";
import type { CatalogItem } from "@/lib/catalog/catalog";

export function ProductCard({ variant }: { variant: CatalogItem }) {
  const displayPriceJpy =
    variant.currentPriceJpy ?? buildMockCatalogPrice(variant.id);
  const trendVariant =
    variant.priceChange24h === null
      ? "outline"
      : variant.priceChange24h >= 0
        ? "success"
        : "destructive";

  return (
    <Link
      aria-label={`Open ${variant.cardName} dashboard`}
      className="block"
      href={{
        pathname: `/cards/${variant.cardId}`,
        query: { variantId: variant.id }
      }}
    >
      <Card className="group overflow-hidden border-white/10 bg-slate-900/80 transition-transform duration-200 hover:-translate-y-1">
        <AspectRatio ratio={2 / 3} className="overflow-hidden bg-slate-950">
          {variant.imageUrl ? (
            <Image
              alt={variant.cardName}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
              src={variant.imageUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-950 text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
              No Image
            </div>
          )}
        </AspectRatio>

        <CardContent className="space-y-3 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate font-mono text-[11px] uppercase tracking-[0.16em] text-slate-400">
              {variant.cardId}
            </p>
            <Badge variant="outline">{variant.rarity ?? "N/A"}</Badge>
          </div>

          <div className="space-y-2">
            <h3 className="line-clamp-2 text-base font-semibold text-slate-50">
              {variant.cardName}
            </h3>
            <Badge variant="secondary" className="w-fit">
              {formatVariantLabel(variant.variantType)}
            </Badge>
          </div>

          <div className="flex items-end justify-between gap-3">
            <p className="text-xl font-bold text-sky-400">
              {formatJPY(displayPriceJpy)}
            </p>
            {variant.priceChange24h !== null ? (
              <Badge variant={trendVariant}>
                {variant.priceChange24h >= 0 ? "+" : ""}
                {variant.priceChange24h.toFixed(2)}%
              </Badge>
            ) : (
              <Badge variant="outline">Flat</Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function formatVariantLabel(variantType: CatalogItem["variantType"]) {
  switch (variantType) {
    case "STD":
      return "Standard Art";
    case "AA":
      return "Parallel Art";
    case "M":
      return "Manga Rare";
    case "SP":
      return "Special Card";
    case "TR":
      return "Treasure Rare";
    case "S":
      return "Serial";
    case "DON":
      return "DON!!";
    default:
      return variantType;
  }
}

function buildMockCatalogPrice(seedKey: string) {
  const seed = hashString(seedKey);
  return 1200 + (seed % 38000);
}

function hashString(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}
