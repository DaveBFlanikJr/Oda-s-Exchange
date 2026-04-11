import { chromium } from "@playwright/test";

import { sourceConfigs } from "../../lib/scraper/sources";
import { getAdminSupabaseClient } from "../../lib/supabase/admin-client";
import { isOutlierPrice, parseJpyPrice } from "../../lib/scraper/jpy";

async function run() {
  const primarySource = sourceConfigs[0];
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(primarySource.listingUrl, {
      waitUntil: "domcontentloaded"
    });

    const rawPrice = await page.locator(".price_tag").first().textContent();
    const cleanJpy = rawPrice ? parseJpyPrice(rawPrice) : null;

    if (!cleanJpy) {
      throw new Error("Could not parse JPY price from Card Rush.");
    }

    if (isOutlierPrice(cleanJpy, 14_000)) {
      console.warn("Outlier detected. Manual review recommended.");
      return;
    }

    const supabase = getAdminSupabaseClient();

    const { error } = await supabase.from("price_history").insert({
      card_code: "OP13-118",
      price_jpy: cleanJpy,
      source_name: primarySource.displayName,
      source_type: primarySource.sourceType
    });

    if (error) {
      throw new Error(error.message);
    }
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
