const FX_RATES = {
  JPY: 1,
  USD: 0.0068,
  EUR: 0.0062
} as const;

const JPY_FORMATTER = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0
});

const CURRENCY_FORMATTERS = {
  JPY: JPY_FORMATTER,
  USD: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }),
  EUR: new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2
  })
} as const;

export type SupportedCurrency = keyof typeof FX_RATES;

export function formatJPY(amount: number) {
  return JPY_FORMATTER.format(Math.round(amount));
}

export function formatCurrency(amount: number, currency: SupportedCurrency) {
  if (currency === "JPY") {
    return formatJPY(amount);
  }

  return CURRENCY_FORMATTERS[currency].format(amount);
}

export function formatPercent(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}% / 24h`;
}

export function convertFromJpy(amountJpy: number, currency: SupportedCurrency) {
  return amountJpy * FX_RATES[currency];
}

export function calculateMedian(prices: number[]) {
  if (prices.length === 0) {
    return 0;
  }

  const sorted = [...prices].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  return sorted[middle];
}

export function calculateSpread(prices: number[]) {
  if (prices.length <= 1) {
    return 0;
  }

  return Math.max(...prices) - Math.min(...prices);
}
