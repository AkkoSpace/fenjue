import "server-only";

import {
  DeleteObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { IMAGE_TYPES, type SupportedImageType } from "@/lib/uploads/constraints";

const UPLOAD_EXPIRES_IN_SECONDS = 5 * 60;
const CACHE_CONTROL = "public, max-age=31536000, immutable";

interface R2Config {
  accountId: string;
  accessKeyId: string;
  bucketName: string;
  secretAccessKey: string;
}

let r2Client: S3Client | undefined;

function getR2Config(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error("R2 write configuration is missing");
  }

  return { accountId, accessKeyId, bucketName, secretAccessKey };
}

export function hasR2WriteConfig() {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME,
  );
}

function getR2Client(config: R2Config) {
  r2Client ??= new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    region: "auto",
  });

  return r2Client;
}

export async function createImageUploadUrl(
  userId: string,
  contentType: SupportedImageType,
) {
  const config = getR2Config();
  const extension = IMAGE_TYPES[contentType];
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "/");
  const objectKey = `prompts/${userId}/${date}/${crypto.randomUUID()}.${extension}`;
  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    CacheControl: CACHE_CONTROL,
    ContentType: contentType,
    Key: objectKey,
  });

  return {
    objectKey,
    requiredHeaders: {
      "cache-control": CACHE_CONTROL,
      "content-type": contentType,
    },
    uploadUrl: await getSignedUrl(getR2Client(config), command, {
      expiresIn: UPLOAD_EXPIRES_IN_SECONDS,
    }),
  };
}

export async function deleteImageObjects(objectKeys: string[]) {
  if (!objectKeys.length) {
    return;
  }

  const config = getR2Config();
  const command = new DeleteObjectsCommand({
    Bucket: config.bucketName,
    Delete: {
      Objects: objectKeys.map((Key) => ({ Key })),
      Quiet: true,
    },
  });

  await getR2Client(config).send(command);
}
