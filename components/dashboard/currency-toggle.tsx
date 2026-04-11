"use client";

import { useState } from "react";

import { convertFromJpy, formatCurrency } from "@/lib/pricing";

const SUPPORTED = ["JPY", "USD", "EUR"] as const;

export function CurrencyToggle({ amountJpy }: { amountJpy: number }) {
  const [currency, setCurrency] = useState<(typeof SUPPORTED)[number]>("JPY");
  const amount =
    currency === "JPY" ? amountJpy : convertFromJpy(amountJpy, currency);

  return (
    <div>
      <div className="toggle-row" role="tablist" aria-label="Display currency">
        {SUPPORTED.map((option) => (
          <button
            key={option}
            className={`toggle ${currency === option ? "active" : ""}`}
            onClick={() => setCurrency(option)}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
      <p className="muted" style={{ marginBottom: 0 }}>
        Reference only: {formatCurrency(amount, currency)}
      </p>
    </div>
  );
}
