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
  const next = safeNext(url.searchParams.get("next"));

  if (code && hasSupabasePublicConfig()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  const target = new URL("/login", url.origin);
  target.searchParams.set("error", "验证链接无效或已经过期。");
  return NextResponse.redirect(target);
}
