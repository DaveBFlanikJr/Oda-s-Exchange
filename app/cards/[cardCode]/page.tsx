import { notFound } from "next/navigation";

import { CardDetailTerminal } from "@/components/dashboard/card-detail-terminal";
import { getCardDetail, isCardDetailLookupError } from "@/lib/card-detail/detail";

type CardPageProps = {
  params: Promise<{
    cardCode: string;
  }>;
  searchParams: Promise<{
    variantId?: string | string[];
  }>;
};

export default async function CardPage({ params, searchParams }: CardPageProps) {
  const { cardCode } = await params;
  const resolvedSearchParams = await searchParams;
  const variantId = Array.isArray(resolvedSearchParams.variantId)
    ? resolvedSearchParams.variantId[0]
    : resolvedSearchParams.variantId;
  let detail = null;

  try {
    detail = await getCardDetail(cardCode, { variantId });
  } catch (error) {
    if (isCardDetailLookupError(error)) {
      console.warn("[card-detail] page lookup failed", {
        cardCode,
        variantId,
        code: error.code
      });
      notFound();
    }

    throw error;
  }

  if (!detail) {
    console.warn("[card-detail] page lookup failed", {
      cardCode,
      variantId,
      code: "card_not_found"
    });
    notFound();
  }

  return <CardDetailTerminal initialData={detail} />;
}
