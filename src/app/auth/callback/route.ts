import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

function safeNext(path: string | null) {
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/account";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const next = safeNext(url.searchParams.get("next"));

  if (hasSupabasePublicConfig()) {
    const supabase = await createClient();
    const result =
      tokenHash && (type === "signup" || type === "recovery")
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : code
          ? await supabase.auth.exchangeCodeForSession(code)
          : undefined;

    if (result && !result.error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const target = new URL(type === "recovery" ? "/forgot-password" : "/login", url.origin);
  target.searchParams.set("error", "验证链接无效或已经过期。");
  return NextResponse.redirect(target);
}
