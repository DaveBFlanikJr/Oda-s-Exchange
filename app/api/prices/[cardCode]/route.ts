import { NextResponse } from "next/server";

import { getPublicPriceHistory } from "@/lib/pricing/queries";
import { rateLimitApiRoute } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{
    cardCode: string;
  }>;
};

type GetPriceRouteDependencies = {
  getPublicPriceHistory: typeof getPublicPriceHistory;
  rateLimitApiRoute: typeof rateLimitApiRoute;
};

export function createGetPriceRouteHandler(
  dependencies: GetPriceRouteDependencies = {
    getPublicPriceHistory,
    rateLimitApiRoute
  }
) {
  return async function GET(request: Request, context: RouteContext) {
    const limit = await dependencies.rateLimitApiRoute(request, "prices");

    if (!limit.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded." },
        { status: 429 }
      );
    }

    const { cardCode } = await context.params;
    const history = await dependencies.getPublicPriceHistory(cardCode);

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
  };
}

export const GET = createGetPriceRouteHandler();
