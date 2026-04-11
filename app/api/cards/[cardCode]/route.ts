import { NextResponse } from "next/server";

import { getCardDetail, isCardDetailLookupError } from "@/lib/card-detail/detail";
import { rateLimitApiRoute } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{
    cardCode: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  const limit = await rateLimitApiRoute(request, "card-detail");

  if (!limit.success) {
    return NextResponse.json({ error: "Rate limit exceeded." }, { status: 429 });
  }

  const { cardCode } = await context.params;
  const { searchParams } = new URL(request.url);
  const variantId = searchParams.get("variantId");
  let detail = null;

  try {
    detail = await getCardDetail(cardCode, { variantId });
  } catch (error) {
    if (isCardDetailLookupError(error)) {
      console.warn("[card-detail] api lookup failed", {
        cardCode,
        variantId,
        code: error.code
      });
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    throw error;
  }

  if (!detail) {
    console.warn("[card-detail] api lookup failed", {
      cardCode,
      variantId,
      code: "card_not_found"
    });
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
