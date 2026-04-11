export function parseJpyPrice(rawPrice: string) {
  const cleanJpy = Number.parseInt(rawPrice.replace(/[^0-9]/g, ""), 10);

  if (Number.isNaN(cleanJpy)) {
    return null;
  }

  return cleanJpy;
}

export function isOutlierPrice(priceJpy: number, averagePriceJpy: number) {
  if (averagePriceJpy <= 0) {
    return false;
  }

  return priceJpy < averagePriceJpy * 0.5;
}
