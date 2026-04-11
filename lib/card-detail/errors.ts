import type { CardDetailLookupErrorCode } from "@/lib/card-detail/types";

export class CardDetailLookupError extends Error {
  code: CardDetailLookupErrorCode;

  constructor(code: CardDetailLookupErrorCode, message: string) {
    super(message);
    this.name = "CardDetailLookupError";
    this.code = code;
  }
}

export function isCardDetailLookupError(
  error: unknown
): error is CardDetailLookupError {
  return error instanceof CardDetailLookupError;
}
