import { Activity, ArrowUpRight, JapaneseYen, ShieldCheck } from "lucide-react";

import { CardSection } from "@/components/ui/card-section";
import { CurrencyToggle } from "@/components/dashboard/currency-toggle";
import { MarketTable } from "@/components/dashboard/market-table";
import { PriceChartPanel } from "@/components/dashboard/price-chart-panel";
import { formatCurrency, formatPercent } from "@/lib/pricing";
import type { CardSnapshot } from "@/lib/types/price";

export function DashboardShell({ snapshot }: { snapshot: CardSnapshot }) {
  const deltaClass = snapshot.change24hPercent >= 0 ? "delta up" : "delta down";

  return (
    <div className="grid">
      <section className="grid hero-grid">
        <article className="card hero-card">
          <div className="eyebrow">
            <ShieldCheck size={14} />
            Tokyo Secondary Market / JPY Source of Truth
          </div>
          <h1 className="hero-title">{snapshot.cardName}</h1>
          <p className="hero-copy">
            High-precision One Piece Card Game tracking focused on Japanese retail
            and peer-to-peer listings with read-only public access and protected
            write paths.
          </p>
          <div className="price-row">
            <div className="price-current">
              {formatCurrency(snapshot.currentPriceJpy, "JPY")}
            </div>
            <div className={deltaClass}>{formatPercent(snapshot.change24hPercent)}</div>
          </div>
          <div className="stats">
            <CardSection label="Card Code" value={snapshot.cardCode} />
            <CardSection label="Last Updated" value={snapshot.lastUpdatedLabel} />
            <CardSection label="Tracked Sources" value={String(snapshot.sources.length)} />
            <CardSection label="Reference FX" value="JPY -> USD / EUR" />
          </div>
        </article>

        <article className="card panel">
          <div className="eyebrow">
            <Activity size={14} />
            Market Status
          </div>
          <h2 className="panel-title">Current signal looks healthy</h2>
          <p className="panel-copy">
            Low-price outliers are flagged before chart ingestion, sold-out states are
            preserved cleanly, and the public app reads from a read-only channel.
          </p>
          <div className="stats">
            <CardSection label="Median Price" value={formatCurrency(snapshot.medianPriceJpy, "JPY")} />
            <CardSection label="Retail Spread" value={formatCurrency(snapshot.spreadJpy, "JPY")} />
            <CardSection label="Outlier Flag" value={snapshot.hasOutlier ? "Review Needed" : "Clear"} />
            <CardSection label="Infra Target" value="$0 / month" />
          </div>
        </article>
      </section>

      <article className="card panel">
        <div className="toolbar">
          <div>
            <div className="eyebrow">
              <ArrowUpRight size={14} />
              Interactive Chart
            </div>
            <h2 className="panel-title">Price action in JPY</h2>
          </div>
          <CurrencyToggle amountJpy={snapshot.currentPriceJpy} />
        </div>
        <PriceChartPanel points={snapshot.points} />
      </article>

      <article className="card panel">
        <h2 className="panel-title">Marketplace snapshot</h2>
        <p className="panel-copy">
          Direct buy links are source-specific. Null prices show as sold out instead of
          breaking the table or chart.
        </p>
        <MarketTable rows={snapshot.sources} />
      </article>
    </div>
  );
}
