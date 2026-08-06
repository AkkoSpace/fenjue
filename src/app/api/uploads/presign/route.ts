import { NextResponse } from "next/server";

import { createImageUploadUrl } from "@/lib/r2/server";
import { createClient } from "@/lib/supabase/server";
import {
  isSupportedImageType,
  MAX_IMAGE_BYTES,
} from "@/lib/uploads/constraints";

interface UploadRequest {
  contentType?: unknown;
  size?: unknown;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email_confirmed_at) {
    return NextResponse.json({ error: "请先登录后再上传图片。" }, { status: 401 });
  }

  let body: UploadRequest;
  try {
    body = (await request.json()) as UploadRequest;
  } catch {
    return NextResponse.json({ error: "上传请求格式不正确。" }, { status: 400 });
  }

  if (
    typeof body.contentType !== "string" ||
    !isSupportedImageType(body.contentType)
  ) {
    return NextResponse.json(
      { error: "仅支持 JPG、PNG、WebP 或 AVIF 图片。" },
      { status: 400 },
    );
  }

  if (
    typeof body.size !== "number" ||
    !Number.isSafeInteger(body.size) ||
    body.size < 1 ||
    body.size > MAX_IMAGE_BYTES
  ) {
    return NextResponse.json(
      { error: "每张图片不能超过 10 MB。" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await createImageUploadUrl(user.id, body.contentType),
    );
  } catch {
    return NextResponse.json(
      { error: "图片存储尚未完成配置，请稍后再试。" },
      { status: 503 },
    );
  }
}
