import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell, AuthShellFallback } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { resendConfirmation, signIn } from "@/lib/auth/actions";
import { type AuthPageProps, getAuthPageState } from "@/lib/auth/page";

export const metadata: Metadata = {
  title: "登录 · 焚诀",
};

export default function LoginPage(props: AuthPageProps) {
  return (
    <Suspense fallback={<AuthShellFallback />}>
      <LoginContent {...props} />
    </Suspense>
  );
}

async function LoginContent({ searchParams }: AuthPageProps) {
  const { message, next } = await getAuthPageState(searchParams);

  return (
    <AuthShell
      description="登录不会改变浏览方式。账户只在你主动使用个人能力或管理内容时出现。"
      eyebrow="Account · 账户"
      message={message}
      title="登录焚诀"
    >
      <form action={signIn} className="space-y-5">
        <input name="next" type="hidden" value={next} />
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
        <PasswordField
          autoComplete="current-password"
          id="password"
          label="密码"
          name="password"
        />
        <div className="flex min-h-11 items-center justify-between gap-4 text-sm">
          <Link
            className="text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            href="/forgot-password"
          >
            忘记密码
          </Link>
          <Link
            className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            href="/register"
          >
            创建账户
          </Link>
        </div>
        <SubmitButton pendingLabel="正在登录">登录</SubmitButton>
        <div className="border-t border-border/80 pt-4 text-center">
          <p className="text-xs leading-5 text-muted-foreground">
            没有收到验证邮件？填写注册邮箱后可以重新发送。
          </p>
          <button
            className="mt-2 min-h-11 text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            formAction={resendConfirmation}
            formNoValidate
            type="submit"
          >
            重新发送验证邮件
          </button>
        </div>
      </form>
    </AuthShell>
  );
}
