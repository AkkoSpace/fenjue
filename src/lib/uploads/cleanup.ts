import "server-only";

import { deleteImageObjects, hasR2WriteConfig } from "@/lib/r2/server";
import {
  createPrivilegedClient,
  hasSupabaseSecretConfig,
} from "@/lib/supabase/privileged";

const DEFAULT_GRACE_HOURS = 24;
const DEFAULT_BATCH_SIZE = 100;

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

export function getImageCleanupReadiness() {
  const missing: string[] = [];
  if (!process.env.CRON_SECRET) missing.push("CRON_SECRET");
  if (!hasSupabaseSecretConfig()) missing.push("SUPABASE_SECRET_KEY");
  if (!hasR2WriteConfig()) missing.push("R2 write configuration");
  return { configured: missing.length === 0, missing };
}

function getGraceHours() {
  return boundedInteger(
    process.env.IMAGE_UPLOAD_GRACE_HOURS,
    DEFAULT_GRACE_HOURS,
    1,
    168,
  );
}

function getBatchSize() {
  return boundedInteger(
    process.env.IMAGE_CLEANUP_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    1,
    500,
  );
}

export async function markImageCleanupComplete(objectKeys: string[]) {
  if (!objectKeys.length || !hasSupabaseSecretConfig()) return;

  const { error } = await createPrivilegedClient().rpc(
    "complete_image_cleanup",
    { p_object_keys: objectKeys },
  );
  if (error) {
    console.warn("Unable to mark image cleanup complete", error.code);
  }
}

export interface ImageCleanupResult {
  cleanedObjects: number;
  status: "cleaned" | "idle";
}

export async function cleanupPendingImageUploads(): Promise<ImageCleanupResult> {
  const readiness = getImageCleanupReadiness();
  if (!readiness.configured) {
    throw new Error(
      `Image cleanup configuration is missing: ${readiness.missing.join(", ")}`,
    );
  }

  const supabase = createPrivilegedClient();
  const claim = await supabase.rpc("claim_image_cleanup_jobs", {
    p_grace_hours: getGraceHours(),
    p_lease_seconds: 15 * 60,
    p_limit: getBatchSize(),
  });

  if (claim.error) {
    throw new Error(`Unable to claim image cleanup jobs (${claim.error.code})`);
  }

  const objectKeys = (claim.data ?? []).flatMap((row: unknown) => {
    if (!row || typeof row !== "object") return [];
    const objectKey = (row as { object_key?: unknown }).object_key;
    return typeof objectKey === "string" ? [objectKey] : [];
  });

  if (!objectKeys.length) return { cleanedObjects: 0, status: "idle" };

  try {
    await deleteImageObjects(objectKeys);
    const completion = await supabase.rpc("complete_image_cleanup", {
      p_object_keys: objectKeys,
    });
    if (completion.error) {
      throw new Error(
        `Unable to complete image cleanup (${completion.error.code})`,
      );
    }
  } catch (error) {
    const failure = await supabase.rpc("fail_image_cleanup", {
      p_error: error instanceof Error ? error.message : "Unknown cleanup error",
      p_object_keys: objectKeys,
    });
    if (failure.error) {
      console.warn("Unable to mark image cleanup failure", failure.error.code);
    }
    throw error;
  }

  return { cleanedObjects: objectKeys.length, status: "cleaned" };
}
