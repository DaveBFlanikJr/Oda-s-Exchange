import assert from "node:assert/strict";
import test from "node:test";

import { createGetPriceRouteHandler } from "@/app/api/prices/[cardCode]/route";
import { getCardDetailWithSupabase } from "@/lib/card-detail/detail";
import { getCatalogItemsWithSupabase } from "@/lib/catalog/catalog";
import { getPublicPriceHistoryWithSupabase } from "@/lib/pricing/queries";
import { createFakeSupabaseClient } from "@/tests/helpers/fake-supabase";

function createBaseCardVariant(cardId: string) {
  return {
    id: `${cardId}_STD`,
    card_id: cardId,
    variant_type: "STD" as const,
    source_variant_key: "STD",
    variant_rarity: "SR",
    image_url: `https://example.invalid/${cardId}.png`,
    set_id: cardId.split("-")[0],
    created_at: "2026-04-01T00:00:00.000Z",
    cards: {
      name_en: `${cardId} Card`,
      rarity_base: "Super Rare"
    }
  };
}

function createBaseCardRow(cardId: string) {
  return {
    id: cardId,
    name_en: `${cardId} Card`,
    name_jp: `${cardId} JP`,
    rarity_base: "Super Rare",
    card_type: "character",
    color: "red",
    cost: 5,
    power: 6000,
    counter: 1000,
    text_en: "Card text",
    text_jp: "JP text"
  };
}

test("public price history returns not_found when no default variant resolves", async () => {
  const supabase = createFakeSupabaseClient({
    card_variants: [],
    price_history: []
  });

  const result = await getPublicPriceHistoryWithSupabase(supabase as never, "eb02-061");

  assert.deepEqual(result, {
    status: "not_found",
    cardCode: "eb02-061"
  });
});

test("public price history keeps unresolved cards at 404 in the route handler", async () => {
  const GET = createGetPriceRouteHandler({
    rateLimitApiRoute: async () => ({ success: true as const }),
    getPublicPriceHistory: async () => ({
      status: "not_found" as const,
      cardCode: "NOPE-000"
    })
  });

  const response = await GET(new Request("http://localhost/api/prices/NOPE-000"), {
    params: Promise.resolve({ cardCode: "NOPE-000" })
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Not found." });
});

test("public price route returns a stable shape and preserves empty qualifying history", async () => {
  const GET = createGetPriceRouteHandler({
    rateLimitApiRoute: async () => ({ success: true as const }),
    getPublicPriceHistory: async () => ({
      status: "ok" as const,
      cardCode: "EB02-061",
      resolvedVariantId: "EB02-061_STD",
      points: []
    })
  });

  const response = await GET(new Request("http://localhost/api/prices/EB02-061"), {
    params: Promise.resolve({ cardCode: "EB02-061" })
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    cardCode: "EB02-061",
    currency: "JPY",
    points: []
  });
});

test("public price history returns only qualifying canonical rows in ascending recorded_at order", async () => {
  const supabase = createFakeSupabaseClient({
    card_variants: [
      {
        id: "EB02-061_STD",
        variant_type: "STD",
        source_variant_key: "STD",
        card_id: "EB02-061"
      }
    ],
    price_history: [
      {
        variant_id: "EB02-061_STD",
        source: "card_rush",
        price_jpy: 1400,
        availability_status: "available",
        recorded_at: "2026-04-18T02:00:00.000Z",
        source_day_jst: "2026-04-18",
        canonical_price_point_id: "cp-2",
        pricing_basis: "daily_best_available_ungraded_best_condition_jst"
      },
      {
        variant_id: "EB02-061_STD",
        source: "card_rush",
        price_jpy: 1200,
        availability_status: "available",
        recorded_at: "2026-04-17T02:00:00.000Z",
        source_day_jst: "2026-04-17",
        canonical_price_point_id: "cp-1",
        pricing_basis: "daily_best_available_ungraded_best_condition_jst"
      },
      {
        variant_id: "EB02-061_STD",
        source: "card_rush",
        price_jpy: 900,
        availability_status: "available",
        recorded_at: "2026-04-19T02:00:00.000Z",
        source_day_jst: null,
        canonical_price_point_id: null,
        pricing_basis: null
      },
      {
        variant_id: "EB02-061_STD",
        source: "card_rush",
        price_jpy: 1100,
        availability_status: "sold_out",
        recorded_at: "2026-04-16T02:00:00.000Z",
        source_day_jst: "2026-04-16",
        canonical_price_point_id: "cp-legacy",
        pricing_basis: "daily_best_available_ungraded_best_condition_jst"
      }
    ]
  });

  const result = await getPublicPriceHistoryWithSupabase(supabase as never, "EB02-061");

  assert.deepEqual(result, {
    status: "ok",
    cardCode: "EB02-061",
    resolvedVariantId: "EB02-061_STD",
    points: [
      { timestamp: "2026-04-17T02:00:00.000Z", priceJpy: 1200 },
      { timestamp: "2026-04-18T02:00:00.000Z", priceJpy: 1400 }
    ]
  });
});

test("public price history returns ok with points [] when a card resolves but has no qualifying canonical history", async () => {
  const supabase = createFakeSupabaseClient({
    card_variants: [
      {
        id: "ST01-001_STD",
        variant_type: "STD",
        source_variant_key: "STD",
        card_id: "ST01-001"
      }
    ],
    price_history: [
      {
        variant_id: "ST01-001_STD",
        source: "card_rush",
        price_jpy: 500,
        availability_status: "available",
        recorded_at: "2026-04-19T02:00:00.000Z",
        source_day_jst: null,
        canonical_price_point_id: null,
        pricing_basis: null
      }
    ]
  });

  const result = await getPublicPriceHistoryWithSupabase(supabase as never, "ST01-001");

  assert.deepEqual(result, {
    status: "ok",
    cardCode: "ST01-001",
    resolvedVariantId: "ST01-001_STD",
    points: []
  });
});

test("catalog snapshots use the latest qualifying canonical day, exact previous JST day change, and no sibling fallback", async () => {
  const supabase = createFakeSupabaseClient({
    card_variants: [
      createBaseCardVariant("EB02-061"),
      {
        ...createBaseCardVariant("EB02-061"),
        id: "EB02-061_P1",
        variant_type: "AA",
        source_variant_key: "P1",
        cards: {
          name_en: "EB02-061 Alt",
          rarity_base: "Secret Rare"
        }
      },
      createBaseCardVariant("OP01-001")
    ],
    price_history: [
      {
        variant_id: "EB02-061_STD",
        source: "card_rush",
        price_jpy: 1000,
        availability_status: "available",
        recorded_at: "2026-04-17T01:00:00.000Z",
        source_day_jst: "2026-04-17",
        canonical_price_point_id: "cp-eb-day1",
        pricing_basis: "daily_best_available_ungraded_best_condition_jst"
      },
      {
        variant_id: "EB02-061_STD",
        source: "card_rush",
        price_jpy: 1300,
        availability_status: "available",
        recorded_at: "2026-04-18T01:00:00.000Z",
        source_day_jst: "2026-04-18",
        canonical_price_point_id: "cp-eb-day2-rush",
        pricing_basis: "daily_best_available_ungraded_best_condition_jst"
      },
      {
        variant_id: "EB02-061_STD",
        source: "mercari_jp",
        price_jpy: 1200,
        availability_status: "available",
        recorded_at: "2026-04-18T03:00:00.000Z",
        source_day_jst: "2026-04-18",
        canonical_price_point_id: "cp-eb-day2-mercari",
        pricing_basis: "daily_best_available_ungraded_best_condition_jst"
      },
      {
        variant_id: "OP01-001_STD",
        source: "card_rush",
        price_jpy: 800,
        availability_status: "available",
        recorded_at: "2026-04-16T01:00:00.000Z",
        source_day_jst: "2026-04-16",
        canonical_price_point_id: "cp-op-day1",
        pricing_basis: "daily_best_available_ungraded_best_condition_jst"
      },
      {
        variant_id: "OP01-001_STD",
        source: "card_rush",
        price_jpy: 900,
        availability_status: "available",
        recorded_at: "2026-04-18T01:00:00.000Z",
        source_day_jst: "2026-04-18",
        canonical_price_point_id: "cp-op-day3",
        pricing_basis: "daily_best_available_ungraded_best_condition_jst"
      }
    ]
  });

  const items = await getCatalogItemsWithSupabase(supabase as never, 10);
  const ebDefault = items.find((item) => item.id === "EB02-061_STD");
  const ebSibling = items.find((item) => item.id === "EB02-061_P1");
  const opDefault = items.find((item) => item.id === "OP01-001_STD");

  assert.equal(ebDefault?.currentPriceJpy, 1200);
  assert.equal(ebDefault?.priceChange24h, 20);
  assert.equal(ebSibling?.currentPriceJpy, null);
  assert.equal(ebSibling?.priceChange24h, null);
  assert.equal(opDefault?.currentPriceJpy, 900);
  assert.equal(opDefault?.priceChange24h, null);
});

test("card detail keeps chart and overview partial when canonical history is empty but raw evidence exists", async () => {
  const supabase = createFakeSupabaseClient({
    card_variants: [createBaseCardVariant("ST01-001")],
    cards: [createBaseCardRow("ST01-001")],
    price_history: [
      {
        variant_id: "ST01-001_STD",
        source: "card_rush",
        price_jpy: 650,
        availability_status: "available",
        recorded_at: "2026-04-19T01:00:00.000Z",
        pricing_basis: null,
        source_day_jst: null,
        canonical_price_point_id: null
      }
    ]
  });

  const detail = await getCardDetailWithSupabase(supabase as never, "ST01-001");

  assert.ok(detail);
  assert.equal(detail?.chart.status, "partial");
  assert.deepEqual(detail?.chart.data, []);
  assert.equal(detail?.overview.status, "partial");
  assert.equal(detail?.marketListings.status, "ready");
  assert.equal(detail?.marketListings.data[0]?.priceJpy, 650);
});

test("card detail chart uses only qualifying canonical rows while market listings still read the latest raw rows", async () => {
  const supabase = createFakeSupabaseClient({
    card_variants: [createBaseCardVariant("EB02-061")],
    cards: [createBaseCardRow("EB02-061")],
    price_history: [
      {
        variant_id: "EB02-061_STD",
        source: "card_rush",
        price_jpy: 1200,
        availability_status: "available",
        recorded_at: "2026-04-17T02:00:00.000Z",
        pricing_basis: "daily_best_available_ungraded_best_condition_jst",
        source_day_jst: "2026-04-17",
        canonical_price_point_id: "cp-eb-valid"
      },
      {
        variant_id: "EB02-061_STD",
        source: "card_rush",
        price_jpy: 900,
        availability_status: "available",
        recorded_at: "2026-04-18T02:00:00.000Z",
        pricing_basis: null,
        source_day_jst: null,
        canonical_price_point_id: null
      }
    ]
  });

  const detail = await getCardDetailWithSupabase(supabase as never, "EB02-061");

  assert.ok(detail);
  assert.equal(detail?.chart.data.length, 1);
  assert.deepEqual(detail?.chart.data[0], {
    day: "2026-04-17",
    recordedAt: "2026-04-17T02:00:00.000Z",
    label: "04/17",
    priceJpy: 1200,
    source: "card_rush"
  });
  assert.equal(detail?.marketListings.data[0]?.priceJpy, 900);
  assert.equal(detail?.marketListings.data[0]?.source, "card_rush");
});
