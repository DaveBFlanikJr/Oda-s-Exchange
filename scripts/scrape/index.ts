async function run() {
  throw new Error(
    [
      "The legacy scraper entrypoint is disabled.",
      "Price ingestion must go through raw_price_observations -> canonical_price_points -> price_history.",
      "Do not write scraped rows directly to price_history."
    ].join(" ")
  );
}

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
