import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/lib/auth/authorization";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: { absolute: "焚诀管理后台" },
};

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<AdminLayoutFallback />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}

function AdminLayoutFallback() {
  return (
    <div className="mx-auto w-full max-w-[96rem] flex-1 px-5 pb-20 pt-6 sm:px-8 lg:pt-10">
      <div className="h-11 w-full animate-pulse bg-muted/50 lg:w-48" />
      <div className="mt-8 h-28 animate-pulse bg-muted/30" />
    </div>
  );
}

async function AdminShell({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();

  return (
    <div className="mx-auto grid w-full max-w-[96rem] flex-1 gap-6 px-5 pb-20 pt-6 sm:px-8 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10 lg:pt-10">
      <aside className="min-w-0">
        <div className="mb-4 hidden border-b border-border pb-4 lg:block">
          <p className="font-serif text-lg text-foreground">焚诀司录</p>
          <p className="mt-1 text-xs text-muted-foreground">内容与权限中枢</p>
        </div>
        <AdminNav />
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
