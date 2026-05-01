import { createGetPriceRouteHandler } from "@/app/api/prices/[cardCode]/route";
import { getCardDetail } from "@/lib/card-detail/detail";
import { getCatalogItemsWithSupabase } from "@/lib/catalog/catalog";
import {
  getPublicPriceHistory,
  getPublicPriceHistoryWithSupabase
} from "@/lib/pricing/queries";
import { getServerSupabaseClient } from "@/lib/supabase/server-client";

function formatCatalogRows(cardId: string, catalog: Awaited<ReturnType<typeof getCatalogItemsWithSupabase>>) {
  return catalog
    .filter((item) => item.cardId === cardId)
    .map((item) => ({
      cardId: item.cardId,
      variant: item.sourceVariantKey,
      currentPriceJpy: item.currentPriceJpy,
      priceChange24h: item.priceChange24h
    }));
}

async function readPriceRoute(cardCode: string) {
  const supabase = getServerSupabaseClient();
  const GET = createGetPriceRouteHandler({
    getPublicPriceHistory: (requestedCardCode) =>
      getPublicPriceHistoryWithSupabase(supabase, requestedCardCode),
    rateLimitApiRoute: async () => ({ success: true as const })
  });
  const response = await GET(new Request(`http://localhost/api/prices/${cardCode}`), {
    params: Promise.resolve({ cardCode })
  });

  return {
    status: response.status,
    body: await response.json()
  };
}

function summarizeCardDetail(detail: Awaited<ReturnType<typeof getCardDetail>>) {
  if (!detail) {
    return null;
  }

  return {
    chartStatus: detail.chart.status,
    chartDays: detail.chart.data.map((point) => point.day),
    overviewStatus: detail.overview.status,
    marketListingsStatus: detail.marketListings.status,
    lastPriceJpy: detail.overview.data.lastPriceJpy
  };
}

async function main() {
  const supabase = getServerSupabaseClient();
  const catalog = await getCatalogItemsWithSupabase(supabase, 5000);
  const ebDetail = await getCardDetail("EB02-061");
  const stDetail = await getCardDetail("ST01-001");

  const summary = {
    catalog: {
      eb02_061: formatCatalogRows("EB02-061", catalog),
      op01_001: formatCatalogRows("OP01-001", catalog),
      st01_001: formatCatalogRows("ST01-001", catalog)
    },
    prices: {
      eb02_061: await readPriceRoute("EB02-061"),
      op01_001: await readPriceRoute("OP01-001"),
      st01_001: await readPriceRoute("ST01-001")
    },
    cardDetail: {
      eb02_061: summarizeCardDetail(ebDetail),
      st01_001: summarizeCardDetail(stDetail)
    }
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
