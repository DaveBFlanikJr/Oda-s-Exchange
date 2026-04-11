import { JST_OFFSET_MS } from "@/lib/card-detail/constants";

export function getRecentJstWindowStartIso(windowDays: number) {
  const now = new Date();
  const jstNow = new Date(now.getTime() + JST_OFFSET_MS);
  jstNow.setUTCHours(0, 0, 0, 0);
  jstNow.setUTCDate(jstNow.getUTCDate() - (windowDays - 1));

  return new Date(jstNow.getTime() - JST_OFFSET_MS).toISOString();
}

export function getJstDayKey(timestamp: string) {
  return new Date(new Date(timestamp).getTime() + JST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

export function shiftJstDay(day: string, deltaDays: number) {
  const base = new Date(`${day}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return base.toISOString().slice(0, 10);
}

export function formatJstDayLabel(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);

  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC"
  }).format(date);
}
