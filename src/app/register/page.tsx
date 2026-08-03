import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthShell, AuthShellFallback } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { signUp } from "@/lib/auth/actions";
import { type AuthPageProps, getAuthPageState } from "@/lib/auth/page";

export const metadata: Metadata = {
  title: "创建账户 · 焚诀",
};

export default function RegisterPage(props: AuthPageProps) {
  return (
    <Suspense fallback={<AuthShellFallback />}>
      <RegisterContent {...props} />
    </Suspense>
  );
}

async function RegisterContent({ searchParams }: AuthPageProps) {
  const { message } = await getAuthPageState(searchParams);

  return (
    <AuthShell
      description="访客始终可以直接浏览和复制。创建账户后，身份将用于后续的个人反馈与内容管理。"
      eyebrow="Account · 账户"
      message={message}
      title="创建账户"
    >
      <form action={signUp} className="space-y-5">
        <div className="space-y-2">
          <label
            className="text-sm font-medium text-foreground"
            htmlFor="displayName"
          >
            昵称 <span className="font-normal text-muted-foreground">（可选）</span>
          </label>
          <Input
            autoComplete="nickname"
            id="displayName"
            maxLength={50}
            name="displayName"
          />
        </div>
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
          autoComplete="new-password"
          id="password"
          label="密码"
          name="password"
        />
        <p className="-mt-3 text-xs leading-5 text-muted-foreground">
          至少 10 个字符，建议使用密码管理器生成并保存。
        </p>
        <PasswordField
          autoComplete="new-password"
          id="passwordConfirmation"
          label="确认密码"
          name="passwordConfirmation"
        />
        <SubmitButton pendingLabel="正在创建">创建账户</SubmitButton>
        <p className="text-center text-sm text-muted-foreground">
          已有账户？{" "}
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
