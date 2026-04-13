import { getAdminSupabaseClient } from "@/lib/supabase/admin-client";
import type {
  PriceIngestionCanonicalPricePointInsert,
  PriceIngestionCanonicalPricePointRow,
  PriceIngestionRawPriceObservationInsert,
  PriceIngestionRawPriceObservationRow,
  PriceIngestionSourceComplianceRecordInsert,
  PriceIngestionSourceComplianceRecordRow
} from "@/lib/pricing/ingestion/types";
import {
  assertCanonicalPricePointInsert,
  assertRawPriceObservationInsert,
  assertSourceComplianceRecordInsert
} from "@/lib/pricing/ingestion/validation";
import type { MarketSourceId } from "@/lib/types/market";
import {
  PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
  type PriceIngestionCanonicalPricingBasis
} from "@/lib/pricing/ingestion/constants";

export type PriceIngestionAdminSupabaseClient = ReturnType<
  typeof getAdminSupabaseClient
>;

const SOURCE_COMPLIANCE_RECORD_COLUMNS =
  "id, source, policy_url, permission_status, allowed_collection_method, collection_frequency_minutes, rate_limit_note, scheduled_collection_enabled, last_reviewed_at, review_notes, created_at, updated_at";

const RAW_PRICE_OBSERVATION_COLUMNS =
  "id, source, source_listing_id, source_url, observed_at, parser_version, normalized_card_code, source_variant_key, raw_title, raw_condition, normalized_condition, raw_price_text, price_jpy, availability_status, listing_kind, normalized_parse_output, raw_text_snapshot, snapshot_ref, excluded_reason, match_confidence, matched_variant_id, created_at, updated_at";

const CANONICAL_PRICE_POINT_COLUMNS =
  "id, variant_id, source, source_day_jst, pricing_basis, condition_scale, price_jpy, observed_at, evidence_kind, raw_observation_id, evidence_ref, selection_rank, selection_reason, derivation_version, created_at, updated_at";

function compactDefinedEntries<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T;
}

function withCanonicalPricePointDefaults(
  record: PriceIngestionCanonicalPricePointInsert
) {
  return {
    pricing_basis: PRICE_INGESTION_DEFAULT_CANONICAL_PRICING_BASIS,
    evidence_kind: "raw_observation" as const,
    ...record
  };
}

export function getPriceIngestionAdminSupabaseClient() {
  return getAdminSupabaseClient();
}

function formatSupabaseError(action: string, message: string) {
  return `Failed to ${action}: ${message}`;
}

export async function getSourceComplianceRecordBySource(
  source: MarketSourceId,
  supabase: PriceIngestionAdminSupabaseClient = getPriceIngestionAdminSupabaseClient()
) {
  const { data, error } = await supabase
    .from("source_compliance_records")
    .select(SOURCE_COMPLIANCE_RECORD_COLUMNS)
    .eq("source", source)
    .maybeSingle();

  if (error) {
    throw new Error(formatSupabaseError("load source compliance record", error.message));
  }

  return (data as PriceIngestionSourceComplianceRecordRow | null) ?? null;
}

export async function listSourceComplianceRecords(
  supabase: PriceIngestionAdminSupabaseClient = getPriceIngestionAdminSupabaseClient()
) {
  const { data, error } = await supabase
    .from("source_compliance_records")
    .select(SOURCE_COMPLIANCE_RECORD_COLUMNS)
    .order("source", { ascending: true });

  if (error) {
    throw new Error(formatSupabaseError("list source compliance records", error.message));
  }

  return (data as PriceIngestionSourceComplianceRecordRow[]) ?? [];
}

export async function upsertSourceComplianceRecord(
  record: PriceIngestionSourceComplianceRecordInsert,
  supabase: PriceIngestionAdminSupabaseClient = getPriceIngestionAdminSupabaseClient()
) {
  assertSourceComplianceRecordInsert(record);

  const { data, error } = await supabase
    .from("source_compliance_records")
    .upsert(compactDefinedEntries(record), { onConflict: "source" })
    .select(SOURCE_COMPLIANCE_RECORD_COLUMNS)
    .single();

  if (error) {
    throw new Error(
      formatSupabaseError("upsert source compliance record", error.message)
    );
  }

  return data as PriceIngestionSourceComplianceRecordRow;
}

export async function insertRawPriceObservation(
  record: PriceIngestionRawPriceObservationInsert,
  supabase: PriceIngestionAdminSupabaseClient = getPriceIngestionAdminSupabaseClient()
) {
  assertRawPriceObservationInsert(record);

  const { data, error } = await supabase
    .from("raw_price_observations")
    .insert(compactDefinedEntries(record))
    .select(RAW_PRICE_OBSERVATION_COLUMNS)
    .single();

  if (error) {
    throw new Error(
      formatSupabaseError("insert raw price observation", error.message)
    );
  }

  return data as PriceIngestionRawPriceObservationRow;
}

export async function insertRawPriceObservations(
  records: readonly PriceIngestionRawPriceObservationInsert[],
  supabase: PriceIngestionAdminSupabaseClient = getPriceIngestionAdminSupabaseClient()
) {
  for (const record of records) {
    assertRawPriceObservationInsert(record);
  }

  if (records.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("raw_price_observations")
    .insert(records.map((record) => compactDefinedEntries(record)))
    .select(RAW_PRICE_OBSERVATION_COLUMNS);

  if (error) {
    throw new Error(
      formatSupabaseError("insert raw price observations", error.message)
    );
  }

  return (data as PriceIngestionRawPriceObservationRow[]) ?? [];
}

export async function insertCanonicalPricePoint(
  record: PriceIngestionCanonicalPricePointInsert,
  supabase: PriceIngestionAdminSupabaseClient = getPriceIngestionAdminSupabaseClient()
) {
  const recordWithDefaults = withCanonicalPricePointDefaults(record);
  assertCanonicalPricePointInsert(recordWithDefaults);

  const { data, error } = await supabase
    .from("canonical_price_points")
    .insert(compactDefinedEntries(recordWithDefaults))
    .select(CANONICAL_PRICE_POINT_COLUMNS)
    .single();

  if (error) {
    throw new Error(
      formatSupabaseError("insert canonical price point", error.message)
    );
  }

  return data as PriceIngestionCanonicalPricePointRow;
}

export async function insertCanonicalPricePoints(
  records: readonly PriceIngestionCanonicalPricePointInsert[],
  supabase: PriceIngestionAdminSupabaseClient = getPriceIngestionAdminSupabaseClient()
) {
  const recordsWithDefaults = records.map(withCanonicalPricePointDefaults);

  for (const record of recordsWithDefaults) {
    assertCanonicalPricePointInsert(record);
  }

  if (recordsWithDefaults.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("canonical_price_points")
    .insert(recordsWithDefaults.map((record) => compactDefinedEntries(record)))
    .select(CANONICAL_PRICE_POINT_COLUMNS);

  if (error) {
    throw new Error(
      formatSupabaseError("insert canonical price points", error.message)
    );
  }

  return (data as PriceIngestionCanonicalPricePointRow[]) ?? [];
}

export async function upsertCanonicalPricePoints(
  records: readonly PriceIngestionCanonicalPricePointInsert[],
  supabase: PriceIngestionAdminSupabaseClient = getPriceIngestionAdminSupabaseClient()
) {
  const recordsWithDefaults = records.map(withCanonicalPricePointDefaults);

  for (const record of recordsWithDefaults) {
    assertCanonicalPricePointInsert(record);
  }

  if (recordsWithDefaults.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("canonical_price_points")
    .upsert(recordsWithDefaults.map((record) => compactDefinedEntries(record)), {
      onConflict: "variant_id,source,source_day_jst,pricing_basis"
    })
    .select(CANONICAL_PRICE_POINT_COLUMNS);

  if (error) {
    throw new Error(
      formatSupabaseError("upsert canonical price points", error.message)
    );
  }

  return (data as PriceIngestionCanonicalPricePointRow[]) ?? [];
}

export async function getLatestRawPriceObservationForSourceListing(
  source: MarketSourceId,
  sourceListingId: string,
  supabase: PriceIngestionAdminSupabaseClient = getPriceIngestionAdminSupabaseClient()
) {
  const { data, error } = await supabase
    .from("raw_price_observations")
    .select(RAW_PRICE_OBSERVATION_COLUMNS)
    .eq("source", source)
    .eq("source_listing_id", sourceListingId)
    .order("observed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      formatSupabaseError("load latest raw price observation", error.message)
    );
  }

  return (data as PriceIngestionRawPriceObservationRow | null) ?? null;
}

export async function listRawPriceObservationsForVariant(
  variantId: string,
  options: {
    limit?: number;
    supabase?: PriceIngestionAdminSupabaseClient;
  } = {}
) {
  const supabase = options.supabase ?? getPriceIngestionAdminSupabaseClient();
  const limit = options.limit ?? 50;

  const { data, error } = await supabase
    .from("raw_price_observations")
    .select(RAW_PRICE_OBSERVATION_COLUMNS)
    .eq("matched_variant_id", variantId)
    .order("observed_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(
      formatSupabaseError("list raw price observations for variant", error.message)
    );
  }

  return (data as PriceIngestionRawPriceObservationRow[]) ?? [];
}

export async function listCanonicalPricePointsForVariant(
  variantId: string,
  options: {
    basis?: PriceIngestionCanonicalPricingBasis;
    sourceDayFrom?: string;
    sourceDayTo?: string;
    limit?: number;
    supabase?: PriceIngestionAdminSupabaseClient;
  } = {}
) {
  const supabase = options.supabase ?? getPriceIngestionAdminSupabaseClient();
  const limit = options.limit ?? 50;

  let query = supabase
    .from("canonical_price_points")
    .select(CANONICAL_PRICE_POINT_COLUMNS)
    .eq("variant_id", variantId);

  if (options.basis) {
    query = query.eq("pricing_basis", options.basis);
  }

  if (options.sourceDayFrom) {
    query = query.gte("source_day_jst", options.sourceDayFrom);
  }

  if (options.sourceDayTo) {
    query = query.lte("source_day_jst", options.sourceDayTo);
  }

  const { data, error } = await query
    .order("source_day_jst", { ascending: false })
    .order("source", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(
      formatSupabaseError("list canonical price points for variant", error.message)
    );
  }

  return (data as PriceIngestionCanonicalPricePointRow[]) ?? [];
}
