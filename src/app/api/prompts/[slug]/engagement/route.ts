import { createHash, randomUUID } from "node:crypto";

import { type NextRequest, NextResponse } from "next/server";

import {
  isPromptReactionLevel,
  normalizePromptEngagementSnapshot,
} from "@/lib/content/engagement";
import { createClient } from "@/lib/supabase/server";

const VISITOR_COOKIE = "fj_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,100}$/;

type EngagementAction = "copy" | "reaction" | "toggle_like" | "view";

interface EngagementRequest {
  action?: unknown;
  reaction?: unknown;
}

function isEngagementAction(value: unknown): value is EngagementAction {
  return (
    value === "copy" ||
    value === "reaction" ||
    value === "toggle_like" ||
    value === "view"
  );
}

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");

  if (!origin || !host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function visitorIdentity(request: NextRequest) {
  const current = request.cookies.get(VISITOR_COOKIE)?.value;
  const visitorId = current && UUID_PATTERN.test(current) ? current : randomUUID();

  return {
    isNew: visitorId !== current,
    visitorHash: createHash("sha256").update(visitorId).digest("hex"),
    visitorId,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!SLUG_PATTERN.test(slug)) {
    return NextResponse.json({ error: "作品标识无效。" }, { status: 400 });
  }

  let body: EngagementRequest;
  try {
    body = (await request.json()) as EngagementRequest;
  } catch {
    return NextResponse.json({ error: "互动请求格式不正确。" }, { status: 400 });
  }

  if (!isEngagementAction(body.action)) {
    return NextResponse.json({ error: "互动类型无效。" }, { status: 400 });
  }

  if (body.action === "reaction" && !isPromptReactionLevel(body.reaction)) {
    return NextResponse.json({ error: "请选择有效的回应。" }, { status: 400 });
  }

  const supabase = await createClient();
  let result: { data: unknown; error: { code?: string } | null };
  let visitor: ReturnType<typeof visitorIdentity> | undefined;

  if (body.action === "view" || body.action === "copy") {
    visitor = visitorIdentity(request);
    result = await supabase.rpc("record_prompt_event", {
      p_event_type: body.action,
      p_slug: slug,
      p_visitor_hash: visitor.visitorHash,
    });
  } else {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: "互动请求来源无效。" }, { status: 403 });
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "登录后可以喜欢作品并添加回应。" },
        { status: 401 },
      );
    }

    result = body.action === "toggle_like"
      ? await supabase.rpc("toggle_prompt_like", { p_slug: slug })
      : await supabase.rpc("toggle_prompt_reaction", {
          p_reaction: body.reaction,
          p_slug: slug,
        });
  }

  if (result.error) {
    console.warn("Unable to update prompt engagement", result.error.code);
    return NextResponse.json(
      { error: "互动暂时没有记录成功，请稍后再试。" },
      { status: 503 },
    );
  }

  const snapshot = normalizePromptEngagementSnapshot(result.data);
  if (!snapshot) {
    return NextResponse.json({ error: "没有找到公开作品。" }, { status: 404 });
  }

  const response = NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });

  if (visitor?.isNew) {
    response.cookies.set(VISITOR_COOKIE, visitor.visitorId, {
      httpOnly: true,
      maxAge: VISITOR_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
