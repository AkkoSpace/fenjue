import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell, AuthShellFallback } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { updatePassword } from "@/lib/auth/actions";
import { type AuthPageProps, getAuthPageState } from "@/lib/auth/page";

export const metadata: Metadata = {
  robots: { follow: true, index: false },
  title: "设置新密码",
};

export default function ResetPasswordPage(props: AuthPageProps) {
  return (
    <Suspense fallback={<AuthShellFallback />}>
      <ResetPasswordContent {...props} />
    </Suspense>
  );
}

async function ResetPasswordContent({ searchParams }: AuthPageProps) {
  const { message } = await getAuthPageState(searchParams);

  return (
    <AuthShell
      description="设置一个新的账户密码。提交后，旧密码将立即失效。"
      eyebrow="Account · 账户"
      message={message}
      title="设置新密码"
    >
      <form action={updatePassword} className="space-y-5">
        <PasswordField
          autoComplete="new-password"
          id="password"
          label="新密码"
          name="password"
        />
        <p className="-mt-3 text-xs leading-5 text-muted-foreground">
          至少 10 个字符，且不要与其他网站共用。
        </p>
        <PasswordField
          autoComplete="new-password"
          id="passwordConfirmation"
          label="确认新密码"
          name="passwordConfirmation"
        />
        <SubmitButton pendingLabel="正在更新">更新密码</SubmitButton>
      </form>
    </AuthShell>
  );
}
