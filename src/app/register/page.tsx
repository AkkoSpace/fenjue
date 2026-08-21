import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  robots: { follow: true, index: false },
  title: "创建账户",
};

export default function RegisterPage() {
  return (
    <AuthShell
      description="访客始终可以直接浏览和复制。创建账户后，身份将用于后续的个人反馈与内容管理。"
      eyebrow="Account · 账户"
      title="创建账户"
    >
      <RegisterForm />
    </AuthShell>
  );
}
