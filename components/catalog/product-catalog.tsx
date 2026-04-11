"use client";

import { useMemo, useState } from "react";
import { Filter } from "lucide-react";

import { ProductCard } from "@/components/catalog/product-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import type { CatalogItem } from "@/lib/catalog/catalog";
import { cn } from "@/lib/utils";

const RARITY_OPTIONS = ["ALL", "SEC", "SR", "R", "UC", "C", "L"] as const;
const SORT_OPTIONS = [
  { label: "Price High-to-Low", value: "price-desc" },
  { label: "Newest", value: "newest" }
] as const;

export function ProductCatalog({ items }: { items: CatalogItem[] }) {
  const [rarity, setRarity] = useState<(typeof RARITY_OPTIONS)[number]>("ALL");
  const [variantMode, setVariantMode] = useState<"all" | "STD" | "parallel">("all");
  const [sortBy, setSortBy] =
    useState<(typeof SORT_OPTIONS)[number]["value"]>("price-desc");
  const [search, setSearch] = useState("");

  const filteredItems = useMemo(() => {
    const nextItems = items.filter((item) => {
      const matchesRarity = rarity === "ALL" || item.rarity === rarity;
      const matchesVariant =
        variantMode === "all"
          ? true
          : variantMode === "STD"
            ? item.variantType === "STD"
            : item.variantType !== "STD";
      const haystack = `${item.cardId} ${item.cardName} ${item.variantType}`.toLowerCase();
      const matchesSearch = search.trim()
        ? haystack.includes(search.trim().toLowerCase())
        : true;

      return matchesRarity && matchesVariant && matchesSearch;
    });

    nextItems.sort((left, right) => {
      if (sortBy === "newest") {
        return (
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
        );
      }

      return (right.currentPriceJpy ?? -1) - (left.currentPriceJpy ?? -1);
    });

    return nextItems;
  }, [items, rarity, search, sortBy, variantMode]);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <Badge variant="outline" className="w-fit">
              Product Catalog
            </Badge>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-50">
                Tokyo Wall
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Responsive market wall with cleaner data hierarchy, fixed card proportions,
                and mobile-first filtering.
              </p>
            </div>
          </div>
          <p className="text-sm font-medium text-slate-400">
            {filteredItems.length.toLocaleString("en-US")} listings
          </p>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid w-full gap-3 lg:max-w-2xl lg:grid-cols-[minmax(0,1fr)_220px]">
            <Input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by ID or name"
              value={search}
            />
            <Select
              aria-label="Sort catalog"
              onChange={(event) =>
                setSortBy(event.target.value as (typeof SORT_OPTIONS)[number]["value"])
              }
              value={sortBy}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" className="w-full sm:w-auto">
                  <Filter className="mr-2 h-4 w-4" />
                  Filters
                </Button>
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetClose asChild>
                    <Button type="button" variant="ghost" size="sm">
                      Close
                    </Button>
                  </SheetClose>
                </SheetHeader>
                <CatalogFilters
                  rarity={rarity}
                  setRarity={setRarity}
                  setSortBy={setSortBy}
                  setVariantMode={setVariantMode}
                  sortBy={sortBy}
                  variantMode={variantMode}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="hidden w-64 shrink-0 lg:block">
          <CatalogFilters
            rarity={rarity}
            setRarity={setRarity}
            setSortBy={setSortBy}
            setVariantMode={setVariantMode}
            sortBy={sortBy}
            variantMode={variantMode}
          />
        </aside>

        <main className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <ProductCard key={item.id} variant={item} />
            ))
          ) : (
            <Card className="col-span-full border-dashed">
              <CardContent className="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
                <p className="text-lg font-semibold text-slate-100">No cards match these filters</p>
                <p className="max-w-md text-sm text-slate-400">
                  Adjust rarity, variant mode, or search terms to widen the wall.
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </section>
  );
}

function CatalogFilters({
  rarity,
  setRarity,
  setSortBy,
  setVariantMode,
  sortBy,
  variantMode
}: {
  rarity: (typeof RARITY_OPTIONS)[number];
  setRarity: (value: (typeof RARITY_OPTIONS)[number]) => void;
  setSortBy: (value: (typeof SORT_OPTIONS)[number]["value"]) => void;
  setVariantMode: (value: "all" | "STD" | "parallel") => void;
  sortBy: (typeof SORT_OPTIONS)[number]["value"];
  variantMode: "all" | "STD" | "parallel";
}) {
  return (
    <Card className="border-white/10 bg-slate-900/75">
      <CardContent className="space-y-6 p-5">
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Filter
            </p>
            <h2 className="text-lg font-semibold text-slate-50">Rarity</h2>
          </div>
          <div className="flex flex-wrap gap-2">
          {RARITY_OPTIONS.map((option) => (
            <Button
              key={option}
              className={cn("rounded-full", rarity === option && "border-sky-400/40 bg-sky-500/15 text-sky-100")}
              onClick={() => setRarity(option)}
              type="button"
              variant="outline"
              size="sm"
            >
              {option}
            </Button>
          ))}
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Variant
          </p>
          <div className="grid gap-2">
          <Button
            className={cn("justify-start", variantMode === "STD" && "border-sky-400/40 bg-sky-500/15 text-sky-100")}
            onClick={() => setVariantMode("STD")}
            type="button"
            variant="outline"
          >
            Standard
          </Button>
          <Button
            className={cn("justify-start", variantMode === "parallel" && "border-sky-400/40 bg-sky-500/15 text-sky-100")}
            onClick={() => setVariantMode("parallel")}
            type="button"
            variant="outline"
          >
            Parallel Art
          </Button>
          <Button
            className={cn("justify-start", variantMode === "all" && "border-sky-400/40 bg-sky-500/15 text-sky-100")}
            onClick={() => setVariantMode("all")}
            type="button"
            variant="outline"
          >
            All Variants
          </Button>
          </div>
        </div>

        <div className="space-y-3 border-t border-white/10 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Sort
          </p>
          <div className="grid gap-2">
          {SORT_OPTIONS.map((option) => (
            <Button
              key={option.value}
              className={cn("justify-start", sortBy === option.value && "border-sky-400/40 bg-sky-500/15 text-sky-100")}
              onClick={() => setSortBy(option.value)}
              type="button"
              variant="outline"
            >
              {option.label}
            </Button>
          ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
