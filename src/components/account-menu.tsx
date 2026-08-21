import { UserRound } from "lucide-react";
import Link from "next/link";

import { AccountMenuClient } from "@/components/account-menu-client";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const guestLinkClassName =
  "inline-flex min-h-11 items-center gap-2 px-1 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring";

export function AccountMenuFallback() {
  return (
    <span
      aria-hidden="true"
      className="size-8 animate-pulse border border-border/80 bg-muted motion-reduce:animate-none"
    />
  );
}

function GuestAccountLink() {
  return (
    <Link className={guestLinkClassName} href="/login">
      <UserRound className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">登录</span>
      <span className="sr-only sm:hidden">登录账户</span>
    </Link>
  );
}

function firstCharacter(value: string) {
  return Array.from(value.trim())[0] ?? "焚";
}

export async function AccountMenu() {
  if (!hasSupabasePublicConfig()) {
    return <GuestAccountLink />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <GuestAccountLink />;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,is_super_admin,role")
    .eq("id", user.id)
    .maybeSingle();
  const emailName = user.email?.split("@")[0];
  const metadataName =
    typeof user.user_metadata?.display_name === "string"
      ? user.user_metadata.display_name.trim()
      : "";
  const displayName =
    profile?.display_name?.trim() ||
    metadataName ||
    emailName ||
    "焚诀用户";
  const isAdmin = profile?.role === "admin";
  const identity = profile?.is_super_admin
    ? "超级管理员"
    : isAdmin
      ? "管理员"
      : "用户";

  return (
    <AccountMenuClient
      avatarText={firstCharacter(displayName)}
      displayName={displayName}
      email={user.email ?? "邮箱未设置"}
      identity={identity}
      isAdmin={isAdmin}
    />
  );
}
