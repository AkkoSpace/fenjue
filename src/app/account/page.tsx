import { LogOut, ShieldCheck } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell, AuthShellFallback } from "@/components/auth/auth-shell";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { type AuthPageProps, getAuthPageState } from "@/lib/auth/page";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "账户 · 焚诀",
};

export default function AccountPage(props: AuthPageProps) {
  return (
    <Suspense fallback={<AuthShellFallback />}>
      <AccountContent {...props} />
    </Suspense>
  );
}

async function AccountContent({ searchParams }: AuthPageProps) {
  if (!hasSupabasePublicConfig()) {
    const params = new URLSearchParams({
      error: "认证服务尚未完成配置，请稍后再试。",
    });
    redirect(`/login?${params.toString()}` as Route);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name,role")
    .eq("id", user.id)
    .maybeSingle();
  const { message } = await getAuthPageState(searchParams);

  return (
    <AuthShell
      description="你的账户不会影响公开浏览。后续收藏与 Reaction 会在这里归属于同一身份。"
      eyebrow="Account · 账户"
      message={message}
      title={profile?.display_name || "我的账户"}
    >
      <dl className="divide-y divide-border/80 border-y border-border/80 text-sm">
        <div className="grid gap-1 py-4 sm:grid-cols-[6rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">邮箱</dt>
          <dd className="break-all text-foreground">{user.email}</dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[6rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">邮箱状态</dt>
          <dd className="text-foreground">
            {user.email_confirmed_at ? "已验证" : "等待验证"}
          </dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[6rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">身份</dt>
          <dd className="text-foreground">
            {profile?.role === "admin" ? "管理员" : "用户"}
          </dd>
        </div>
      </dl>

      {profile?.role === "admin" ? (
        <Link
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-6 min-h-11 w-full rounded-sm",
          )}
          href={"/admin" as Route}
        >
          <ShieldCheck aria-hidden="true" />
          进入内容管理
        </Link>
      ) : null}

      <form action={signOut} className={profile?.role === "admin" ? "mt-3" : "mt-6"}>
        <Button
          className="min-h-11 w-full rounded-sm"
          size="lg"
          type="submit"
          variant="outline"
        >
          <LogOut data-icon="inline-start" aria-hidden="true" />
          退出登录
        </Button>
      </form>
    </AuthShell>
  );
}
