import { createReadStream, existsSync } from "node:fs";
import { resolve } from "node:path";

import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse";
import sharp from "sharp";

import {
  normalizeRecord,
  truncate,
} from "./lib/nano-banana-record.mjs";

const IMPORT_SOURCE = "youmind-nano-banana-pro-20260802";
const MAX_IMAGE_BYTES = 35 * 1024 * 1024;
const CACHE_CONTROL = "public, max-age=31536000, immutable";

for (const envFile of [".env.local", ".env.import.local"]) {
  const path = resolve(envFile);
  if (existsSync(path)) process.loadEnvFile(path);
}

function parseArgs(argv) {
  const options = {
    batchSize: 50,
    concurrency: 4,
    dryRun: false,
    file: "",
    limit: Number.POSITIVE_INFINITY,
    offset: 0,
    retryIncomplete: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--retry-incomplete") options.retryIncomplete = true;
    else if (argument === "--file") options.file = argv[++index] ?? "";
    else if (argument === "--limit") options.limit = Number(argv[++index]);
    else if (argument === "--offset") options.offset = Number(argv[++index]);
    else if (argument === "--concurrency")
      options.concurrency = Number(argv[++index]);
    else if (argument === "--batch-size")
      options.batchSize = Number(argv[++index]);
    else throw new Error(`未知参数：${argument}`);
  }

  if (!options.file) throw new Error("请通过 --file 指定 CSV 文件路径。");
  for (const [name, value] of [
    ["offset", options.offset],
    ["concurrency", options.concurrency],
    ["batch-size", options.batchSize],
  ]) {
    if (!Number.isSafeInteger(value) || value < (name === "offset" ? 0 : 1)) {
      throw new Error(`${name} 必须是有效整数。`);
    }
  }
  if (
    options.limit !== Number.POSITIVE_INFINITY &&
    (!Number.isSafeInteger(options.limit) || options.limit < 1)
  ) {
    throw new Error("limit 必须是正整数。");
  }
  options.concurrency = Math.min(options.concurrency, 12);
  options.batchSize = Math.min(options.batchSize, 100);
  return options;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

async function mapLimit(values, limit, mapper) {
  const output = new Array(values.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      output[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return output;
}

function sleep(milliseconds) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

async function fetchImage(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          "user-agent": "Fenjue-Importer/1.0 (+https://fenjue.akko.space)",
        },
        redirect: "follow",
        signal: AbortSignal.timeout(60_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (contentLength > MAX_IMAGE_BYTES) throw new Error("图片超过 35MB");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
        throw new Error("图片内容为空或超过 35MB");
      }
      return buffer;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(attempt * 700);
    }
  }
  throw lastError;
}

function createR2Client() {
  const accountId = requireEnv("R2_ACCOUNT_ID");
  return {
    bucket: requireEnv("R2_BUCKET_NAME"),
    client: new S3Client({
      credentials: {
        accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
        secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
      },
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      region: "auto",
    }),
  };
}

function isMissingObject(error) {
  return (
    error?.name === "NotFound" ||
    error?.$metadata?.httpStatusCode === 404 ||
    error?.Code === "NoSuchKey"
  );
}

async function uploadMedia({ bucket, client }, adminId, record, url, position, stats) {
  const key = `prompts/${adminId}/imports/nano-banana-pro/${record.externalId}/${position}.webp`;
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const width = Number(head.Metadata?.width);
    const height = Number(head.Metadata?.height);
    if (Number.isSafeInteger(width) && width > 0 && Number.isSafeInteger(height) && height > 0) {
      stats.reusedImages += 1;
      return { alt: truncate(`${record.title} · ${position}`, 240), height, object_key: key, position, width };
    }
  } catch (error) {
    if (!isMissingObject(error)) throw error;
  }

  const input = await fetchImage(url);
  const { data, info } = await sharp(input, { animated: false })
    .rotate()
    .resize({
      fit: "inside",
      height: 4096,
      kernel: "lanczos3",
      width: 4096,
      withoutEnlargement: true,
    })
    .webp({ effort: 4, quality: 88, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });
  if (!info.width || !info.height) throw new Error("无法识别图片尺寸");

  await client.send(
    new PutObjectCommand({
      Body: data,
      Bucket: bucket,
      CacheControl: CACHE_CONTROL,
      ContentType: "image/webp",
      Key: key,
      Metadata: {
        height: String(info.height),
        source: IMPORT_SOURCE,
        width: String(info.width),
      },
    }),
  );
  stats.uploadedImages += 1;
  return {
    alt: truncate(`${record.title} · ${position}`, 240),
    height: info.height,
    object_key: key,
    position,
    width: info.width,
  };
}

function createSupabaseClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

async function existingStatuses(supabase, secret, externalIds) {
  const { data, error } = await supabase.rpc("import_nano_banana_status", {
    p_external_ids: externalIds,
    p_secret: secret,
  });
  if (error) throw new Error(`查询导入状态失败：${error.message}`);
  return new Map((data ?? []).map((row) => [row.external_id, row.import_status]));
}

async function writeRecords(supabase, secret, records) {
  if (!records.length) return;
  const { data, error } = await supabase.rpc("import_nano_banana_batch", {
    p_records: records,
    p_secret: secret,
  });
  if (error) throw new Error(`写入 Supabase 失败：${error.message}`);
  return data;
}

async function prepareRecord(r2, adminId, record, stats) {
  const results = await mapLimit(
    record.mediaUrls,
    2,
    async (url, index) => {
      try {
        return await uploadMedia(r2, adminId, record, url, index + 1, stats);
      } catch (error) {
        stats.failedImages += 1;
        record.notes.push(`第 ${index + 1} 张图片处理失败：${error.message}`);
        return null;
      }
    },
  );
  const images = results.filter(Boolean);
  let importStatus = "ready";
  if (!record.mediaUrls.length) importStatus = "missing_media";
  else if (images.length !== record.mediaUrls.length || record.notes.length) {
    importStatus = "needs_review";
  }

  return {
    author_name: record.authorName,
    author_url: record.authorUrl,
    category_key: record.categoryKey,
    external_id: record.externalId,
    images,
    import_note: record.notes.length ? record.notes.join("；") : null,
    import_status: importStatus,
    prompt: record.prompt,
    source_description: record.description || null,
    source_published_at: record.sourcePublishedAt,
    source_url: record.sourceUrl,
    tag_keys: record.tagKeys,
    title: record.title,
  };
}

async function* readBatches(file, offset, limit, batchSize) {
  const parser = createReadStream(file).pipe(
    parse({
      bom: true,
      columns: true,
      relax_column_count: false,
      skip_empty_lines: true,
      trim: false,
    }),
  );
  let sourceIndex = 0;
  let selected = 0;
  let batch = [];
  for await (const row of parser) {
    if (sourceIndex++ < offset) continue;
    if (selected >= limit) break;
    selected += 1;
    batch.push(row);
    if (batch.length >= batchSize) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length) yield batch;
}

async function dryRun(options) {
  const stats = { categories: {}, hidden: 0, ready: 0, rows: 0, tags: {} };
  for await (const batch of readBatches(options.file, options.offset, options.limit, options.batchSize)) {
    for (const row of batch) {
      const record = normalizeRecord(row);
      stats.rows += 1;
      stats.categories[record.categoryKey] = (stats.categories[record.categoryKey] ?? 0) + 1;
      for (const tag of record.tagKeys) stats.tags[tag] = (stats.tags[tag] ?? 0) + 1;
      if (record.mediaUrls.length && !record.notes.length) stats.ready += 1;
      else stats.hidden += 1;
    }
  }
  console.log(JSON.stringify(stats, null, 2));
}

async function run(options) {
  const secret = requireEnv("NANO_BANANA_IMPORT_SECRET");
  const adminId = requireEnv("NANO_BANANA_IMPORT_USER_ID");
  const supabase = createSupabaseClient();
  const r2 = createR2Client();
  const stats = {
    failedImages: 0,
    hidden: 0,
    imported: 0,
    ready: 0,
    reusedImages: 0,
    seen: 0,
    skipped: 0,
    uploadedImages: 0,
  };

  for await (const sourceBatch of readBatches(
    options.file,
    options.offset,
    options.limit,
    options.batchSize,
  )) {
    const records = sourceBatch.map(normalizeRecord);
    stats.seen += records.length;
    const statuses = await existingStatuses(
      supabase,
      secret,
      records.map((record) => record.externalId),
    );
    const pending = records.filter((record) => {
      const status = statuses.get(record.externalId);
      const skip = status && !(options.retryIncomplete && status === "needs_review");
      if (skip) stats.skipped += 1;
      return !skip;
    });
    const prepared = await mapLimit(pending, options.concurrency, (record) =>
      prepareRecord(r2, adminId, record, stats),
    );

    for (let index = 0; index < prepared.length; index += 20) {
      const writeBatch = prepared.slice(index, index + 20);
      await writeRecords(supabase, secret, writeBatch);
      stats.imported += writeBatch.length;
      stats.ready += writeBatch.filter((record) => record.import_status === "ready").length;
      stats.hidden += writeBatch.filter((record) => record.import_status !== "ready").length;
    }
    console.log(
      `[${stats.seen}] 新增 ${stats.imported}，跳过 ${stats.skipped}，公开 ${stats.ready}，待处理 ${stats.hidden}，R2 新传 ${stats.uploadedImages} / 复用 ${stats.reusedImages} / 失败 ${stats.failedImages}`,
    );
  }
  console.log(JSON.stringify(stats, null, 2));
}

const options = parseArgs(process.argv.slice(2));
if (!existsSync(resolve(options.file))) throw new Error(`CSV 不存在：${options.file}`);
if (options.dryRun) await dryRun(options);
else await run(options);
