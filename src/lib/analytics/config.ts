import "server-only";

import { hasSupabaseSecretConfig } from "@/lib/supabase/privileged";

export const DEFAULT_ANALYTICS_RETENTION_DAYS = 180;
export const DEFAULT_ANALYTICS_ARCHIVE_BATCH_SIZE = 10_000;

function boundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum
    ? value
    : fallback;
}

export function getAnalyticsRetentionDays() {
  return boundedInteger(
    process.env.ANALYTICS_HOT_RETENTION_DAYS,
    DEFAULT_ANALYTICS_RETENTION_DAYS,
    30,
    3650,
  );
}

export function getAnalyticsArchiveBatchSize() {
  return boundedInteger(
    process.env.ANALYTICS_ARCHIVE_BATCH_SIZE,
    DEFAULT_ANALYTICS_ARCHIVE_BATCH_SIZE,
    100,
    25_000,
  );
}

export function getAnalyticsArchiveReadiness() {
  const missing: string[] = [];
  const analyticsBucket = process.env.R2_ANALYTICS_BUCKET_NAME;

  if (!process.env.CRON_SECRET) missing.push("CRON_SECRET");
  if (!hasSupabaseSecretConfig()) missing.push("SUPABASE_SECRET_KEY");
  if (!(process.env.R2_ANALYTICS_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID)) {
    missing.push("R2_ANALYTICS_ACCOUNT_ID");
  }
  if (!(process.env.R2_ANALYTICS_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID)) {
    missing.push("R2_ANALYTICS_ACCESS_KEY_ID");
  }
  if (
    !(
      process.env.R2_ANALYTICS_SECRET_ACCESS_KEY ??
      process.env.R2_SECRET_ACCESS_KEY
    )
  ) {
    missing.push("R2_ANALYTICS_SECRET_ACCESS_KEY");
  }
  if (!analyticsBucket) missing.push("R2_ANALYTICS_BUCKET_NAME");

  const usesPublicImageBucket = Boolean(
    analyticsBucket &&
      process.env.R2_BUCKET_NAME &&
      analyticsBucket === process.env.R2_BUCKET_NAME,
  );

  return {
    configured: missing.length === 0 && !usesPublicImageBucket,
    missing,
    usesPublicImageBucket,
  };
}
