import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell, AuthShellFallback } from "@/components/auth/auth-shell";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "@/lib/auth/actions";
import { type AuthPageProps, getAuthPageState } from "@/lib/auth/page";

export const metadata: Metadata = {
  title: "重置密码 · 焚诀",
};

export default function ForgotPasswordPage(props: AuthPageProps) {
  return (
    <Suspense fallback={<AuthShellFallback />}>
      <ForgotPasswordContent {...props} />
    </Suspense>
  );
}

async function ForgotPasswordContent({ searchParams }: AuthPageProps) {
  const { message } = await getAuthPageState(searchParams);

  return (
    <AuthShell
      description="输入注册邮箱，我们会发送一次性重置链接。为了保护账户信息，无论邮箱是否存在，页面都会给出相同结果。"
      eyebrow="Account · 账户"
      message={message}
      title="找回密码"
    >
      <form action={requestPasswordReset} className="space-y-5">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground" htmlFor="email">
            邮箱
          </label>
          <Input
            autoComplete="email"
            id="email"
            inputMode="email"
            name="email"
            required
            type="email"
          />
        </div>
        <SubmitButton pendingLabel="正在发送">发送重置邮件</SubmitButton>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            href="/login"
          >
            返回登录
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
