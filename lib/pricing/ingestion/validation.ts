import {
  PRICE_INGESTION_CANONICAL_PRICING_BASES,
  PRICE_INGESTION_COLLECTION_METHODS,
  PRICE_INGESTION_CONDITION_SCALES,
  PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
  PRICE_INGESTION_EVIDENCE_KINDS,
  PRICE_INGESTION_LISTING_KINDS,
  PRICE_INGESTION_MATCH_CONFIDENCES,
  PRICE_INGESTION_SOURCE_POLICY_STATUSES
} from "@/lib/pricing/ingestion/constants";
import {
  type PriceIngestionCanonicalPricePointInsert,
  type PriceIngestionRawPriceObservationInsert,
  type PriceIngestionSourceComplianceRecordInsert
} from "@/lib/pricing/ingestion/types";
import type { AvailabilityStatus } from "@/lib/types/market";

export type PriceIngestionValidationIssue = {
  field: string;
  message: string;
};

const NORMALIZED_CARD_CODE_PATTERN = /^[A-Z]{1,3}([0-9]{2})?-[0-9]{3}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function pushIssue(
  issues: PriceIngestionValidationIssue[],
  field: string,
  message: string
) {
  issues.push({ field, message });
}

function isAllowedAvailabilityStatus(
  value: unknown
): value is AvailabilityStatus {
  return value === "available" || value === "sold_out" || value === "error";
}

function isIntegerLike(value: unknown) {
  return typeof value === "number" && Number.isInteger(value);
}

function isJsonLikeValue(
  value: unknown
): value is Record<string, unknown> | readonly unknown[] {
  return value !== null && typeof value === "object";
}

function isValidIsoDate(value: string) {
  return ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function isValidIsoTimestamp(value: string) {
  return !Number.isNaN(Date.parse(value));
}

export function validateSourceComplianceRecordInsert(
  record: PriceIngestionSourceComplianceRecordInsert
) {
  const issues: PriceIngestionValidationIssue[] = [];

  if (!record.source) {
    pushIssue(issues, "source", "source is required");
  }

  if (!isNonEmptyString(record.policy_url)) {
    pushIssue(issues, "policy_url", "policy_url is required");
  }

  if (
    typeof record.permission_status === "string" &&
    !PRICE_INGESTION_SOURCE_POLICY_STATUSES.includes(record.permission_status)
  ) {
    pushIssue(issues, "permission_status", "permission_status is not valid");
  }

  if (
    typeof record.allowed_collection_method === "string" &&
    !PRICE_INGESTION_COLLECTION_METHODS.includes(record.allowed_collection_method)
  ) {
    pushIssue(
      issues,
      "allowed_collection_method",
      "allowed_collection_method is not valid"
    );
  }

  if (
    record.collection_frequency_minutes !== undefined &&
    record.collection_frequency_minutes !== null &&
    (!isIntegerLike(record.collection_frequency_minutes) ||
      record.collection_frequency_minutes <= 0)
  ) {
    pushIssue(
      issues,
      "collection_frequency_minutes",
      "collection_frequency_minutes must be a positive integer"
    );
  }

  if (
    typeof record.rate_limit_note === "string" &&
    record.rate_limit_note.length > 500
  ) {
    pushIssue(issues, "rate_limit_note", "rate_limit_note must be 500 characters or less");
  }

  if (
    typeof record.review_notes === "string" &&
    record.review_notes.length > 2000
  ) {
    pushIssue(issues, "review_notes", "review_notes must be 2000 characters or less");
  }

  if (
    typeof record.last_reviewed_at === "string" &&
    !isValidIsoDate(record.last_reviewed_at)
  ) {
    pushIssue(issues, "last_reviewed_at", "last_reviewed_at must be a valid ISO date");
  }

  if (record.scheduled_collection_enabled) {
    const collectionMethod = record.allowed_collection_method ?? "unknown";
    const frequency = record.collection_frequency_minutes ?? null;
    const permissionStatus = record.permission_status ?? "unknown";

    if (permissionStatus !== "approved") {
      pushIssue(
        issues,
        "scheduled_collection_enabled",
        "scheduled_collection_enabled requires approved permission_status"
      );
    }

    if (
      !["authorized_feed", "api", "html_scrape"].includes(collectionMethod)
    ) {
      pushIssue(
        issues,
        "scheduled_collection_enabled",
        "scheduled_collection_enabled requires an approved collection method"
      );
    }

    if (frequency === null) {
      pushIssue(
        issues,
        "scheduled_collection_enabled",
        "scheduled_collection_enabled requires collection_frequency_minutes"
      );
    }
  }

  return issues;
}

export function assertSourceComplianceRecordInsert(
  record: PriceIngestionSourceComplianceRecordInsert
) {
  const issues = validateSourceComplianceRecordInsert(record);

  if (issues.length > 0) {
    throw new Error(
      `Invalid source compliance record: ${issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join("; ")}`
    );
  }
}

export function validateRawPriceObservationInsert(
  record: PriceIngestionRawPriceObservationInsert
) {
  const issues: PriceIngestionValidationIssue[] = [];
  const availabilityStatus = record.availability_status ?? "available";
  const matchConfidence = record.match_confidence ?? "low";
  const listingKind = record.listing_kind ?? "unknown";
  const normalizedCondition = record.normalized_condition ?? "unknown";

  if (!record.source) {
    pushIssue(issues, "source", "source is required");
  }

  if (!isNonEmptyString(record.source_listing_id)) {
    pushIssue(issues, "source_listing_id", "source_listing_id is required");
  }

  if (!isNonEmptyString(record.source_url)) {
    pushIssue(issues, "source_url", "source_url is required");
  }

  if (!isNonEmptyString(record.parser_version)) {
    pushIssue(issues, "parser_version", "parser_version is required");
  }

  if (!isNonEmptyString(record.normalized_card_code)) {
    pushIssue(issues, "normalized_card_code", "normalized_card_code is required");
  } else if (!NORMALIZED_CARD_CODE_PATTERN.test(record.normalized_card_code)) {
    pushIssue(
      issues,
      "normalized_card_code",
      "normalized_card_code must match the expected card code format"
    );
  }

  if (
    typeof record.source_variant_key === "string" &&
    record.source_variant_key.length > 128
  ) {
    pushIssue(
      issues,
      "source_variant_key",
      "source_variant_key must be 128 characters or less"
    );
  }

  if (
    typeof record.raw_text_snapshot === "string" &&
    record.raw_text_snapshot.length > 8192
  ) {
    pushIssue(
      issues,
      "raw_text_snapshot",
      "raw_text_snapshot must be 8192 characters or less"
    );
  }

  if (
    record.normalized_parse_output !== undefined &&
    record.normalized_parse_output !== null &&
    !isJsonLikeValue(record.normalized_parse_output)
  ) {
    pushIssue(
      issues,
      "normalized_parse_output",
      "normalized_parse_output must be an object, array, null, or undefined"
    );
  }

  if (
    typeof record.price_jpy === "number" &&
    (!isIntegerLike(record.price_jpy) || record.price_jpy < 0)
  ) {
    pushIssue(issues, "price_jpy", "price_jpy must be a non-negative integer");
  }

  if (!isAllowedAvailabilityStatus(availabilityStatus)) {
    pushIssue(issues, "availability_status", "availability_status is not valid");
  }

  if (!PRICE_INGESTION_LISTING_KINDS.includes(listingKind)) {
    pushIssue(issues, "listing_kind", "listing_kind is not valid");
  }

  if (!PRICE_INGESTION_CONDITION_SCALES.includes(normalizedCondition)) {
    pushIssue(
      issues,
      "normalized_condition",
      "normalized_condition is not valid"
    );
  }

  if (!PRICE_INGESTION_MATCH_CONFIDENCES.includes(matchConfidence)) {
    pushIssue(
      issues,
      "match_confidence",
      "match_confidence is not valid"
    );
  }

  if (availabilityStatus === "available") {
    if (record.price_jpy === undefined || record.price_jpy === null || record.price_jpy <= 0) {
      pushIssue(
        issues,
        "price_jpy",
        "available observations require a positive price_jpy"
      );
    }
  } else if (availabilityStatus === "sold_out" || availabilityStatus === "error") {
    if (record.price_jpy !== undefined && record.price_jpy !== null) {
      pushIssue(
        issues,
        "price_jpy",
        "sold_out and error observations must not include price_jpy"
      );
    }
  }

  if (
    typeof record.observed_at === "string" &&
    !isValidIsoTimestamp(record.observed_at)
  ) {
    pushIssue(issues, "observed_at", "observed_at must be a valid ISO timestamp");
  }

  if (
    matchConfidence === "excluded" &&
    !isNonEmptyString(record.excluded_reason)
  ) {
    pushIssue(
      issues,
      "excluded_reason",
      "excluded_reason is required when match_confidence is excluded"
    );
  }

  return issues;
}

export function assertRawPriceObservationInsert(
  record: PriceIngestionRawPriceObservationInsert
) {
  const issues = validateRawPriceObservationInsert(record);

  if (issues.length > 0) {
    throw new Error(
      `Invalid raw price observation: ${issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join("; ")}`
    );
  }
}

export function validateCanonicalPricePointInsert(
  record: PriceIngestionCanonicalPricePointInsert
) {
  const issues: PriceIngestionValidationIssue[] = [];
  const pricingBasis =
    record.pricing_basis ?? PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS;
  const evidenceKind = record.evidence_kind ?? "raw_observation";

  if (!isNonEmptyString(record.variant_id)) {
    pushIssue(issues, "variant_id", "variant_id is required");
  }

  if (!record.source) {
    pushIssue(issues, "source", "source is required");
  }

  if (!isNonEmptyString(record.source_day_jst)) {
    pushIssue(issues, "source_day_jst", "source_day_jst is required");
  } else if (!isValidIsoDate(record.source_day_jst)) {
    pushIssue(
      issues,
      "source_day_jst",
      "source_day_jst must be a valid ISO date"
    );
  }

  if (!PRICE_INGESTION_CANONICAL_PRICING_BASES.includes(pricingBasis)) {
    pushIssue(issues, "pricing_basis", "pricing_basis is not valid");
  }

  if (!PRICE_INGESTION_CONDITION_SCALES.includes(record.condition_scale)) {
    pushIssue(issues, "condition_scale", "condition_scale is not valid");
  }

  if (!isIntegerLike(record.price_jpy) || record.price_jpy <= 0) {
    pushIssue(issues, "price_jpy", "price_jpy must be a positive integer");
  }

  if (!isNonEmptyString(record.observed_at)) {
    pushIssue(issues, "observed_at", "observed_at is required");
  } else if (!isValidIsoTimestamp(record.observed_at)) {
    pushIssue(issues, "observed_at", "observed_at must be a valid ISO timestamp");
  }

  if (!PRICE_INGESTION_EVIDENCE_KINDS.includes(evidenceKind)) {
    pushIssue(issues, "evidence_kind", "evidence_kind is not valid");
  }

  if (evidenceKind === "raw_observation" && !isNonEmptyString(record.raw_observation_id)) {
    pushIssue(
      issues,
      "raw_observation_id",
      "raw_observation_id is required for raw_observation evidence"
    );
  }

  if (evidenceKind === "authorized_feed" && !isNonEmptyString(record.evidence_ref)) {
    pushIssue(
      issues,
      "evidence_ref",
      "evidence_ref is required for authorized_feed evidence"
    );
  }

  if (
    record.evidence_ref !== undefined &&
    record.evidence_ref !== null &&
    !isNonEmptyString(record.evidence_ref)
  ) {
    pushIssue(issues, "evidence_ref", "evidence_ref must not be empty");
  }

  if (
    record.selection_rank !== undefined &&
    (!isIntegerLike(record.selection_rank) || record.selection_rank < 0)
  ) {
    pushIssue(
      issues,
      "selection_rank",
      "selection_rank must be a non-negative integer"
    );
  }

  if (
    record.selection_reason !== undefined &&
    record.selection_reason.length > 2000
  ) {
    pushIssue(
      issues,
      "selection_reason",
      "selection_reason must be 2000 characters or less"
    );
  }

  if (!isNonEmptyString(record.derivation_version)) {
    pushIssue(issues, "derivation_version", "derivation_version is required");
  }

  return issues;
}

export function assertCanonicalPricePointInsert(
  record: PriceIngestionCanonicalPricePointInsert
) {
  const issues = validateCanonicalPricePointInsert(record);

  if (issues.length > 0) {
    throw new Error(
      `Invalid canonical price point: ${issues
        .map((issue) => `${issue.field}: ${issue.message}`)
        .join("; ")}`
    );
  }
}
