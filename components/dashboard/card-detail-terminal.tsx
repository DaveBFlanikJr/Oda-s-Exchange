"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ExternalLink, PackageSearch, ShieldCheck, ShoppingBag, Store } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatJPY } from "@/lib/pricing";
import type { CardDetailResponse } from "@/lib/card-detail/detail";
import type { VariantType } from "@/lib/types/cards";
import type { MarketSourceId } from "@/lib/types/market";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

const TABS = ["overview", "inventory"] as const;

export function CardDetailTerminal({
  initialData
}: {
  initialData: CardDetailResponse;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("overview");
  const [zoomed, setZoomed] = useState(false);
  const data = initialData;
  const overview = {
    status: data.overview?.status ?? "empty",
    data: {
      lastPriceJpy: data.overview?.data?.lastPriceJpy ?? null,
      change1dPct: data.overview?.data?.change1dPct ?? null,
      range7d: {
        low: data.overview?.data?.range7d?.low ?? null,
        high: data.overview?.data?.range7d?.high ?? null
      }
    },
    meta: {
      pricingBasis: data.overview?.meta?.pricingBasis ?? "daily_best_available_jst",
      comparisonStatus: data.overview?.meta?.comparisonStatus ?? "missing",
      freshnessAt: data.overview?.meta?.freshnessAt ?? null,
      truncated: data.overview?.meta?.truncated ?? false,
      simulated: data.overview?.meta?.simulated ?? false,
      windowDays: data.overview?.meta?.windowDays ?? 35,
      latestDay: data.overview?.meta?.latestDay ?? null,
      rangeCoverageDays: data.overview?.meta?.rangeCoverageDays ?? 0,
      timezone: data.overview?.meta?.timezone ?? "Asia/Tokyo"
    }
  };
  const chart = {
    status: data.chart?.status ?? "empty",
    data: data.chart?.data ?? [],
    meta: {
      pricingBasis: data.chart?.meta?.pricingBasis ?? "daily_best_available_jst",
      freshnessAt: data.chart?.meta?.freshnessAt ?? null,
      truncated: data.chart?.meta?.truncated ?? false,
      simulated: data.chart?.meta?.simulated ?? false,
      windowDays: data.chart?.meta?.windowDays ?? 35,
      coverageDays: data.chart?.meta?.coverageDays ?? 0,
      timezone: data.chart?.meta?.timezone ?? "Asia/Tokyo",
      bucket: data.chart?.meta?.bucket ?? "day"
    }
  };
  const marketListings = {
    status: data.marketListings?.status ?? "empty",
    data: data.marketListings?.data ?? [],
    meta: {
      basis: data.marketListings?.meta?.basis ?? "latest_row_currently_available_by_source",
      freshnessAt: data.marketListings?.meta?.freshnessAt ?? null,
      simulated: data.marketListings?.meta?.simulated ?? false,
      searchPrecision: data.marketListings?.meta?.searchPrecision ?? "card_level",
      inspectedSources: data.marketListings?.meta?.inspectedSources ?? 0
    }
  };
  const sentiment = getSentimentLabel(overview.data.change1dPct);

  return (
    <main className="shell">
      <div className="detail-page-actions">
        <Link className={buttonVariants({ size: "sm", variant: "outline" })} href="/">
          Back to Catalog
        </Link>
      </div>
      <section className="detail-layout">
        <aside className="card detail-hero">
          <button
            className={`detail-image-shell ${zoomed ? "zoomed" : ""}`}
            onClick={() => setZoomed((value) => !value)}
            type="button"
          >
            {data.activeVariant.imageUrl ? (
              <Image
                alt={data.card.nameEn}
                className="detail-card-image"
                fill
                sizes="(max-width: 900px) 100vw, 40vw"
                src={data.activeVariant.imageUrl}
              />
            ) : (
              <div className="catalog-image-fallback">No Image</div>
            )}
            <span className="detail-image-toggle">High-Res</span>
          </button>
          <div className="detail-badge-row">
            <span className="catalog-variant">{humanizeVariant(data.activeVariant.variantType)}</span>
            <span className="catalog-rarity">{data.card.rarityBase ?? data.activeVariant.variantRarity}</span>
          </div>
          <h1 className="detail-card-title">{data.card.nameEn}</h1>
          <p className="catalog-id">{data.card.id}</p>
        </aside>

        <section className="detail-main">
          <div className="detail-tabs">
            <div className="toggle-row" role="tablist" aria-label="Card detail tabs">
              <button className={`toggle ${tab === "overview" ? "active" : ""}`} onClick={() => setTab("overview")} type="button">Overview</button>
              <button className={`toggle ${tab === "inventory" ? "active" : ""}`} onClick={() => setTab("inventory")} type="button">Inventory</button>
            </div>
          </div>

          {tab === "overview" ? (
            <div className="grid">
              <div className="detail-ticker-grid">
                <article className="card panel">
                  <p className="catalog-kicker">Last Price</p>
                  <p className="detail-ticker-price">
                    {formatMetricCurrency(data.overview.data.lastPriceJpy)}
                  </p>
                  <p className="panel-copy">
                    {overview.meta.pricingBasis === "daily_best_available_jst"
                      ? "Daily best available (JST)"
                      : "Pricing basis unavailable"}
                  </p>
                  <span className={`catalog-trend ${getTrendClass(overview.data.change1dPct)}`}>
                    {formatPercentChange(overview.data.change1dPct)}
                  </span>
                </article>
                <article className="card panel">
                  <p className="catalog-kicker">7D Range</p>
                  <p className="detail-ticker-price small">
                    {formatMetricCurrency(overview.data.range7d.low)}
                  </p>
                  <p className="panel-copy">
                    High {formatMetricCurrency(overview.data.range7d.high)}
                  </p>
                </article>
                <article className="card panel">
                  <p className="catalog-kicker">Market Sentiment</p>
                  <p className="detail-ticker-price small">{sentiment}</p>
                  <span className={`catalog-trend ${sentiment === "Bullish" ? "up" : "down"}`}>
                    {sentiment}
                  </span>
                </article>
              </div>

              <article className="card panel">
                <div className="toolbar">
                  <div>
                    <p className="catalog-kicker">Overview</p>
                    <h2 className="panel-title">Price history</h2>
                  </div>
                </div>
                <div className="chart-canvas">
                  {chart.data.length > 0 ? (
                    <ResponsiveContainer height="100%" width="100%">
                      <AreaChart data={chart.data} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                        <defs>
                          <linearGradient id="detailAreaFill" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.45} />
                            <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                        <XAxis axisLine={false} dataKey="label" tick={{ fill: "#94a3b8", fontSize: 12 }} tickLine={false} />
                        <YAxis
                          axisLine={false}
                          tick={{ fill: "#94a3b8", fontSize: 12 }}
                          tickFormatter={(value: number) => formatJPY(value)}
                          tickLine={false}
                          width={96}
                        />
                        <Tooltip content={<DetailTooltip />} />
                        <Area dataKey="priceJpy" fill="url(#detailAreaFill)" stroke="#60a5fa" strokeWidth={3} type="monotone" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                      <PackageSearch className="mb-3 h-8 w-8 text-slate-500" />
                      <p className="text-sm text-slate-300">No recent price history available</p>
                      <p className="mt-2 max-w-md text-xs text-slate-500">
                        This chart only renders real daily market data from the last {chart.meta.windowDays} days.
                      </p>
                    </div>
                  )}
                </div>
                <p className="panel-copy">
                  {describeChartState(chart.status, chart.meta.coverageDays, chart.meta.windowDays)}
                </p>
              </article>

              <LiveMarketplaceCard listingsSection={marketListings} />
            </div>
          ) : null}

          {tab === "inventory" ? (
            <div className="grid">
              <article className="card panel">
                <h2 className="panel-title">Card data</h2>
                <div className="stats">
                  <div className="card stat">
                    <p className="stat-label">Type</p>
                    <p className="stat-value">{data.card.cardType}</p>
                  </div>
                  <div className="card stat">
                    <p className="stat-label">Color</p>
                    <p className="stat-value">{data.card.color ?? "N/A"}</p>
                  </div>
                  <div className="card stat">
                    <p className="stat-label">Cost / Power</p>
                    <p className="stat-value">{data.card.cost ?? "-"} / {data.card.power ?? "-"}</p>
                  </div>
                  <div className="card stat">
                    <p className="stat-label">Counter</p>
                    <p className="stat-value">{data.card.counter ?? "N/A"}</p>
                  </div>
                </div>
              </article>
              <article className="card panel">
                <h2 className="panel-title">Variants</h2>
                <div className="detail-variant-list">
                  {data.variants.map((variant) => (
                    <div className="detail-variant-row" key={variant.id}>
                      <span className="catalog-id">{variant.id}</span>
                      <span className="catalog-variant">{humanizeVariant(variant.variantType)}</span>
                      <span className="catalog-rarity">{variant.variantRarity}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function DetailTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: CardDetailResponse["chart"]["data"][number] }>; label?: string }) {
  if (!active || !payload?.length) {
    return null;
  }

  const point = payload[0].payload;

  return (
    <div className="detail-tooltip">
      <p className="catalog-kicker" style={{ marginBottom: 6 }}>{label}</p>
      <p className="detail-tooltip-price">{formatCurrency(Math.round(point.priceJpy), "JPY")}</p>
      <p className="panel-copy" style={{ marginTop: 6 }}>{humanizeSource(point.source)}</p>
    </div>
  );
}

function humanizeSource(source: MarketSourceId) {
  if (source === "card_rush") {
    return "Card Rush";
  }
  if (source === "yuyu_tei") {
    return "Yuyu-Tei";
  }
  return "Mercari JP";
}

function LiveMarketplaceCard({
  listingsSection
}: {
  listingsSection: CardDetailResponse["marketListings"];
}) {
  const listings = listingsSection.data;

  return (
    <Card className="border-white/10 bg-slate-950">
      <CardHeader className="space-y-2">
        <p className="catalog-kicker">Live Data</p>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Live Marketplace</CardTitle>
            <CardDescription>Current buying opportunities surfaced from connected marketplaces.</CardDescription>
          </div>
          <ShoppingBag className="h-5 w-5 shrink-0 text-sky-400" />
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {listings.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950 text-center">
            <PackageSearch className="mb-3 h-8 w-8 text-slate-500" />
            <p className="text-sm text-slate-400">No current listings found</p>
            <p className="mt-2 max-w-sm text-xs text-slate-500">
              Listings only appear when the newest source row is both priced and currently available.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listings.map((listing) => (
                <TableRow
                  className={listing.isBestPrice ? "bg-emerald-500/5 ring-1 ring-inset ring-emerald-500/30" : undefined}
                  key={`${listing.source}-${listing.url}`}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-slate-900 text-sky-300">
                        {getMarketplaceIcon(listing.source)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-100">{humanizeSource(listing.source)}</span>
                        {listing.isBestPrice ? <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">Best Price</Badge> : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300">{listing.condition}</TableCell>
                  <TableCell className="text-right text-base font-semibold text-slate-50">
                    {formatCurrency(Math.round(listing.priceJpy), "JPY")}
                  </TableCell>
                  <TableCell className="text-right">
                    <a
                      className={buttonVariants({ size: "sm", variant: "outline" })}
                      href={listing.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="flex items-center gap-2">
                        View Listing
                        <ExternalLink className="h-4 w-4" />
                      </span>
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function getMarketplaceIcon(source: CardDetailResponse["marketListings"]["data"][number]["source"]) {
  if (source === "mercari_jp") {
    return <ShoppingBag className="h-4 w-4" />;
  }

  if (source === "yuyu_tei") {
    return <ShieldCheck className="h-4 w-4" />;
  }

  return <Store className="h-4 w-4" />;
}

function humanizeVariant(variant: VariantType) {
  if (variant === "STD") return "Standard Art";
  if (variant === "AA") return "Parallel Art";
  if (variant === "M") return "Manga Art";
  if (variant === "SP") return "Special Card";
  if (variant === "TR") return "Treasure Rare";
  if (variant === "S") return "Serial";
  return "DON";
}

function formatMetricCurrency(value: number | null) {
  if (value === null) {
    return "Unavailable";
  }

  return formatCurrency(Math.round(value), "JPY");
}

function formatPercentChange(value: number | null | undefined) {
  if (value == null) {
    return "Comparison unavailable";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getTrendClass(value: number | null | undefined) {
  if (value == null) {
    return "down";
  }

  return value >= 0 ? "up" : "down";
}

function getSentimentLabel(change1dPct: number | null | undefined) {
  if (change1dPct != null && change1dPct > 2) {
    return "Bullish";
  }

  return "Stable";
}

function describeChartState(status: CardDetailResponse["chart"]["status"], coverageDays: number, windowDays: number) {
  if (status === "ready") {
    return `Coverage spans ${coverageDays} daily points across the last ${windowDays} days.`;
  }

  if (status === "partial") {
    return `Coverage is partial: ${coverageDays} daily points were available within the last ${windowDays} days.`;
  }

  if (status === "simulated") {
    return "This view is showing simulated data.";
  }

  return `No daily price points were available within the last ${windowDays} days.`;
}
