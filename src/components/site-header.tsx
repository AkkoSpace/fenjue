import Link from "next/link";
import { Suspense } from "react";

import { AccountMenu, AccountMenuFallback } from "@/components/account-menu";

export function SiteHeader() {
  return (
    <header className="border-b border-border/80">
      <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center justify-between px-5 sm:px-8">
        <Link className="group flex items-center gap-3" href="/" aria-label="焚诀首页">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center border border-primary/70 font-serif text-lg text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
          >
            焚
          </span>
          <span className="font-serif text-lg tracking-[0.08em]">焚诀</span>
        </Link>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="hidden sm:inline">卷一 · 文生图</span>
          <Suspense fallback={<AccountMenuFallback />}>
            <AccountMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
