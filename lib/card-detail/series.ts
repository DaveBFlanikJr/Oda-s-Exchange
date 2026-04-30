import { CARD_DETAIL_WINDOW_DAYS } from "@/lib/card-detail/constants";
import { formatJstDayLabel, getJstDayKey, shiftJstDay } from "@/lib/card-detail/time";
import type {
  ComparisonStatus,
  DailySeriesPoint,
  PriceHistoryRow,
  SectionStatus
} from "@/lib/card-detail/types";

function getSeriesDayKey(row: PriceHistoryRow) {
  return row.source_day_jst ?? getJstDayKey(row.recorded_at);
}

export function buildDailySeries(history: PriceHistoryRow[]): DailySeriesPoint[] {
  const latestValidRowsBySourceDay = new Map<string, PriceHistoryRow>();

  for (const row of history) {
    if (row.availability_status !== "available" || row.price_jpy === null) {
      continue;
    }

    const day = getSeriesDayKey(row);
    const key = `${row.source}:${day}`;
    const existing = latestValidRowsBySourceDay.get(key);

    if (
      !existing ||
      new Date(row.recorded_at).getTime() > new Date(existing.recorded_at).getTime()
    ) {
      latestValidRowsBySourceDay.set(key, row);
    }
  }

  const candidateRowsByDay = new Map<string, PriceHistoryRow[]>();

  for (const row of latestValidRowsBySourceDay.values()) {
    const day = getSeriesDayKey(row);
    const rows = candidateRowsByDay.get(day) ?? [];
    rows.push(row);
    candidateRowsByDay.set(day, rows);
  }

  return [...candidateRowsByDay.entries()]
    .sort(([leftDay], [rightDay]) => leftDay.localeCompare(rightDay))
    .map(([day, rows]) => {
      const bestRow = rows.reduce((best, current) => {
        if (
          (current.price_jpy ?? Number.POSITIVE_INFINITY) <
          (best.price_jpy ?? Number.POSITIVE_INFINITY)
        ) {
          return current;
        }

        if (
          current.price_jpy === best.price_jpy &&
          new Date(current.recorded_at).getTime() > new Date(best.recorded_at).getTime()
        ) {
          return current;
        }

        return best;
      });

      return {
        day,
        recordedAt: bestRow.recorded_at,
        label: formatJstDayLabel(day),
        priceJpy: Math.round(bestRow.price_jpy ?? 0),
        source: bestRow.source
      };
    });
}

export function deriveChartStatus(
  series: DailySeriesPoint[],
  history: PriceHistoryRow[]
): SectionStatus {
  if (series.length === 0) {
    return history.length > 0 ? "partial" : "empty";
  }

  return series.length < CARD_DETAIL_WINDOW_DAYS ? "partial" : "ready";
}

export function deriveOverviewStatus(
  latestPoint: DailySeriesPoint | null,
  previousDayPoint: DailySeriesPoint | null,
  rangePoints: DailySeriesPoint[],
  chartStatus: SectionStatus
): SectionStatus {
  if (!latestPoint || rangePoints.length === 0) {
    return chartStatus === "partial" ? "partial" : "empty";
  }

  if (chartStatus === "partial" || !previousDayPoint || rangePoints.length < 7) {
    return "partial";
  }

  return "ready";
}

export function deriveComparisonStatus(
  latestPoint: DailySeriesPoint | null,
  previousDayPoint: DailySeriesPoint | null
): ComparisonStatus {
  if (!latestPoint || !previousDayPoint) {
    return "missing";
  }

  return "available";
}

export function findExactPreviousDayPoint(series: DailySeriesPoint[], day: string) {
  const targetDay = shiftJstDay(day, -1);
  return series.find((point) => point.day === targetDay) ?? null;
}

export function getWindowPoints(
  series: DailySeriesPoint[],
  latestDay: string,
  windowDays: number
) {
  const earliestDay = shiftJstDay(latestDay, -(windowDays - 1));

  return series.filter((point) => point.day >= earliestDay && point.day <= latestDay);
}
