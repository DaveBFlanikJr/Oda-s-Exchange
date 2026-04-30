import { NextResponse } from "next/server";

import { getPublicPriceHistory } from "@/lib/pricing/queries";
import { rateLimitApiRoute } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{
    cardCode: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limit = await rateLimitApiRoute(request, "prices");

  if (!limit.success) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429 }
    );
  }

  const { cardCode } = await context.params;
  const history = await getPublicPriceHistory(cardCode);

  if (history.status === "not_found") {
    console.warn("[prices] api lookup failed", {
      cardCode,
      code: "card_not_found"
    });

    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({
    cardCode: history.cardCode,
    currency: "JPY",
    points: history.points
  });
}
