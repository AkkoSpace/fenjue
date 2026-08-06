import "server-only";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { cache } from "react";

import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const getAdminContext = cache(async () => {
  if (!hasSupabasePublicConfig()) {
    return { status: "unconfigured" as const };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "unauthenticated" as const };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return { status: "forbidden" as const };
  }

  return {
    profile,
    status: "authorized" as const,
    supabase,
    user,
  };
});

export async function requireAdmin(next: Route = "/admin" as Route) {
  const context = await getAdminContext();

  if (context.status === "unconfigured") {
    const params = new URLSearchParams({
      error: "认证服务尚未完成配置，请稍后再试。",
    });
    redirect(`/login?${params.toString()}` as Route);
  }

  if (context.status === "unauthenticated") {
    const params = new URLSearchParams({ next });
    redirect(`/login?${params.toString()}` as Route);
  }

  if (context.status === "forbidden") {
    const params = new URLSearchParams({
      error: "当前账户没有管理权限。",
    });
    redirect(`/account?${params.toString()}` as Route);
  }

  return context;
}
