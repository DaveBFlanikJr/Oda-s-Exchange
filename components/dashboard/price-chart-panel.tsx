"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { formatCurrency, formatJPY } from "@/lib/pricing";
import type { PricePoint } from "@/lib/types/price";

const WINDOWS = ["1D", "1W", "1M", "3M", "ALL"] as const;

export function PriceChartPanel({ points }: { points: PricePoint[] }) {
  const [activeWindow, setActiveWindow] = useState<(typeof WINDOWS)[number]>("1M");
  const filteredPoints = useMemo(() => filterPoints(points, activeWindow), [points, activeWindow]);

  return (
    <div className="chart-shell">
      <div className="toolbar">
        <div className="toggle-row" role="tablist" aria-label="Chart timeframe">
          {WINDOWS.map((windowKey) => (
            <button
              key={windowKey}
              className={`toggle ${activeWindow === windowKey ? "active" : ""}`}
              onClick={() => setActiveWindow(windowKey)}
              type="button"
            >
              {windowKey}
            </button>
          ))}
        </div>
        <span className="muted">{filteredPoints.length} tracked points</span>
      </div>
      <div className="chart-canvas" aria-label="Price chart">
        <ResponsiveContainer height="100%" width="100%">
          <AreaChart data={filteredPoints} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="catalogAreaFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
            <XAxis
              axisLine={false}
              dataKey="label"
              minTickGap={28}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickLine={false}
            />
            <YAxis
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 12 }}
              tickFormatter={(value: number) => formatJPY(value)}
              tickLine={false}
              width={72}
            />
            <Tooltip
              contentStyle={{
                background: "rgba(15, 23, 42, 0.96)",
                border: "1px solid rgba(148, 163, 184, 0.16)",
                borderRadius: "16px",
                color: "#e2e8f0"
              }}
              formatter={(value: number) => formatCurrency(value, "JPY")}
              labelStyle={{ color: "#94a3b8" }}
            />
            <Area
              dataKey="priceJpy"
              fill="url(#catalogAreaFill)"
              stroke="#22c55e"
              strokeWidth={3}
              type="monotone"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-meta">
        <CardMeta label="Series" value="Area / #22c55e" />
        <CardMeta label="Window" value={activeWindow} />
        <CardMeta label="Source of truth" value="JPY" />
      </div>
    </div>
  );
}

function filterPoints(points: PricePoint[], windowKey: (typeof WINDOWS)[number]) {
  const sorted = [...points].sort(
    (left, right) =>
      new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime()
  );
  const sliceLength =
    windowKey === "1D"
      ? 1
      : windowKey === "1W"
        ? Math.min(7, sorted.length)
        : windowKey === "1M"
          ? Math.min(30, sorted.length)
          : windowKey === "3M"
            ? Math.min(90, sorted.length)
            : sorted.length;

  return sorted.slice(-sliceLength).map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric"
    }).format(new Date(point.timestamp))
  }));
}

function CardMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
    </div>
  );
}
