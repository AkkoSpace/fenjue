import "server-only";

import {
  getAnalyticsArchiveReadiness,
  getAnalyticsRetentionDays,
} from "@/lib/analytics/config";
import { requireAdmin } from "@/lib/auth/authorization";

function count(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : value;
  return typeof parsed === "number" &&
    Number.isSafeInteger(parsed) &&
    parsed > 0
    ? parsed
    : 0;
}

export async function getAdminAnalyticsStorageOverview() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc(
    "admin_get_analytics_storage_overview",
  );

  if (error) {
    console.warn("Unable to load analytics storage overview", error.code);
  }

  const raw = data && typeof data === "object"
    ? (data as Record<string, unknown>)
    : {};
  const readiness = getAnalyticsArchiveReadiness();

  return {
    archivedBytes: count(raw.archived_compressed_bytes),
    archivedEvents: count(raw.archived_events),
    archivedFiles: count(raw.archived_files),
    configured: readiness.configured,
    lastArchivedAt:
      typeof raw.last_archived_at === "string" ? raw.last_archived_at : null,
    oldestHotEventDate:
      typeof raw.oldest_hot_event_date === "string"
        ? raw.oldest_hot_event_date
        : null,
    pendingBatches: count(raw.pending_batches),
    retainedEvents: count(raw.hot_events),
    retentionDays: getAnalyticsRetentionDays(),
    usesPublicImageBucket: readiness.usesPublicImageBucket,
  };
}
