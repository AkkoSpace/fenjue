import "server-only";

import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import {
  getAnalyticsArchiveBatchSize,
  getAnalyticsArchiveReadiness,
  getAnalyticsRetentionDays,
} from "@/lib/analytics/config";
import { createPrivilegedClient } from "@/lib/supabase/privileged";

const ARCHIVE_FORMAT_VERSION = 1;
const ARCHIVE_LEASE_SECONDS = 15 * 60;
const ARCHIVE_PAGE_SIZE = 1000;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ClaimedArchiveBatch {
  attemptCount: number;
  eventCount: number;
  id: string;
  maxEventDate: string;
  minEventDate: string;
}

interface MetricEventRow {
  created_at: string;
  event_date: string;
  event_type: "copy" | "view";
  prompt_id: string;
  visitor_hash: string;
}

interface AnalyticsR2Config {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  secretAccessKey: string;
}

let analyticsClient: S3Client | undefined;

function getAnalyticsR2Config(): AnalyticsR2Config {
  const readiness = getAnalyticsArchiveReadiness();
  if (!readiness.configured) {
    if (readiness.usesPublicImageBucket) {
      throw new Error("Analytics archives require a private R2 bucket");
    }

    throw new Error(
      `Analytics archive configuration is missing: ${readiness.missing.join(", ")}`,
    );
  }

  return {
    accessKeyId: (
      process.env.R2_ANALYTICS_ACCESS_KEY_ID ?? process.env.R2_ACCESS_KEY_ID
    )!,
    accountId: (
      process.env.R2_ANALYTICS_ACCOUNT_ID ?? process.env.R2_ACCOUNT_ID
    )!,
    bucketName: process.env.R2_ANALYTICS_BUCKET_NAME!,
    secretAccessKey: (
      process.env.R2_ANALYTICS_SECRET_ACCESS_KEY ??
      process.env.R2_SECRET_ACCESS_KEY
    )!,
  };
}

function getAnalyticsR2Client(config: AnalyticsR2Config) {
  analyticsClient ??= new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  });

  return analyticsClient;
}

function parseClaimedBatch(value: unknown): ClaimedArchiveBatch | null {
  if (value === null) return null;
  if (!value || typeof value !== "object") {
    throw new Error("Archive claim returned an invalid payload");
  }

  const row = value as Record<string, unknown>;
  const eventCount = Number(row.event_count);
  const attemptCount = Number(row.attempt_count);
  const id = typeof row.id === "string" ? row.id : "";
  const minEventDate =
    typeof row.min_event_date === "string" ? row.min_event_date : "";
  const maxEventDate =
    typeof row.max_event_date === "string" ? row.max_event_date : "";

  if (
    !UUID_PATTERN.test(id) ||
    !Number.isSafeInteger(eventCount) ||
    eventCount < 1 ||
    !Number.isSafeInteger(attemptCount) ||
    attemptCount < 1 ||
    !/^\d{4}-\d{2}-\d{2}$/.test(minEventDate) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(maxEventDate)
  ) {
    throw new Error("Archive claim returned invalid batch fields");
  }

  return { attemptCount, eventCount, id, maxEventDate, minEventDate };
}

function cutoffDate(retentionDays: number) {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
  return cutoff.toISOString().slice(0, 10);
}

function serializeEvents(events: MetricEventRow[]) {
  const lines = events.map((event) =>
    JSON.stringify({
      created_at: event.created_at,
      event_date: event.event_date,
      event_type: event.event_type,
      prompt_id: event.prompt_id,
      visitor_hash: event.visitor_hash,
    }),
  );

  return Buffer.from(`${lines.join("\n")}\n`, "utf8");
}

async function loadClaimedEvents(
  supabase: ReturnType<typeof createPrivilegedClient>,
  batch: ClaimedArchiveBatch,
) {
  const events: MetricEventRow[] = [];

  for (let from = 0; from < batch.eventCount; from += ARCHIVE_PAGE_SIZE) {
    const to = Math.min(from + ARCHIVE_PAGE_SIZE, batch.eventCount) - 1;
    const { data, error } = await supabase
      .from("prompt_metric_events")
      .select("prompt_id,visitor_hash,event_type,event_date,created_at")
      .eq("archive_batch_id", batch.id)
      .order("event_date", { ascending: true })
      .order("created_at", { ascending: true })
      .order("prompt_id", { ascending: true })
      .order("event_type", { ascending: true })
      .order("visitor_hash", { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Unable to read claimed metric events (${error.code})`);
    }

    events.push(...((data ?? []) as MetricEventRow[]));
  }

  if (events.length !== batch.eventCount) {
    throw new Error("Claimed metric event count changed before archival");
  }

  return events;
}

async function uploadArchive(
  batch: ClaimedArchiveBatch,
  compressed: Buffer,
  sha256: string,
) {
  const config = getAnalyticsR2Config();
  const client = getAnalyticsR2Client(config);
  const [year, month] = batch.minEventDate.split("-");
  const objectKey =
    `analytics/prompt-metrics/v${ARCHIVE_FORMAT_VERSION}/` +
    `${year}/${month}/${batch.id}.ndjson.gz`;
  const metadata = {
    "content-sha256": sha256,
    "event-count": String(batch.eventCount),
    "format-version": String(ARCHIVE_FORMAT_VERSION),
  };

  await client.send(
    new PutObjectCommand({
      Body: compressed,
      Bucket: config.bucketName,
      CacheControl: "private, max-age=31536000, immutable",
      ContentDisposition: `attachment; filename="${batch.id}.ndjson.gz"`,
      ContentEncoding: "gzip",
      ContentLength: compressed.byteLength,
      ContentType: "application/x-ndjson",
      Key: objectKey,
      Metadata: metadata,
    }),
  );

  const head = await client.send(
    new HeadObjectCommand({ Bucket: config.bucketName, Key: objectKey }),
  );

  if (
    head.ContentLength !== compressed.byteLength ||
    head.Metadata?.["content-sha256"] !== sha256 ||
    head.Metadata?.["event-count"] !== String(batch.eventCount)
  ) {
    throw new Error("R2 archive verification failed");
  }

  return objectKey;
}

export interface AnalyticsArchiveResult {
  archivedBytes: number;
  archivedEvents: number;
  batchId: string | null;
  retentionDays: number;
  status: "archived" | "idle";
}

export async function archiveOldestPromptMetricBatch(): Promise<AnalyticsArchiveResult> {
  const readiness = getAnalyticsArchiveReadiness();
  if (!readiness.configured) {
    throw new Error("Analytics archive is not fully configured");
  }

  const retentionDays = getAnalyticsRetentionDays();
  const supabase = createPrivilegedClient();
  let batch: ClaimedArchiveBatch | null = null;

  try {
    const claim = await supabase.rpc("claim_prompt_metric_archive", {
      p_cutoff: cutoffDate(retentionDays),
      p_lease_seconds: ARCHIVE_LEASE_SECONDS,
      p_limit: getAnalyticsArchiveBatchSize(),
    });

    if (claim.error) {
      throw new Error(`Unable to claim metric archive (${claim.error.code})`);
    }

    batch = parseClaimedBatch(claim.data);
    if (!batch) {
      return {
        archivedBytes: 0,
        archivedEvents: 0,
        batchId: null,
        retentionDays,
        status: "idle",
      };
    }

    const events = await loadClaimedEvents(supabase, batch);
    const compressed = gzipSync(serializeEvents(events), { level: 9 });
    const sha256 = createHash("sha256").update(compressed).digest("hex");
    const objectKey = await uploadArchive(batch, compressed, sha256);
    const completion = await supabase.rpc("complete_prompt_metric_archive", {
      p_batch_id: batch.id,
      p_compressed_bytes: compressed.byteLength,
      p_content_sha256: sha256,
      p_event_count: batch.eventCount,
      p_object_key: objectKey,
    });

    if (completion.error) {
      throw new Error(
        `Unable to complete metric archive (${completion.error.code})`,
      );
    }

    return {
      archivedBytes: compressed.byteLength,
      archivedEvents: batch.eventCount,
      batchId: batch.id,
      retentionDays,
      status: "archived",
    };
  } catch (error) {
    if (batch) {
      const failure = await supabase.rpc("fail_prompt_metric_archive", {
        p_batch_id: batch.id,
        p_error: error instanceof Error ? error.message : "Unknown error",
      });

      if (failure.error) {
        console.warn("Unable to mark analytics archive as failed", failure.error.code);
      }
    }

    throw error;
  }
}
