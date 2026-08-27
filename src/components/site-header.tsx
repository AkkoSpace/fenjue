import Link from "next/link";
import { Suspense } from "react";

import { AccountMenu, AccountMenuFallback } from "@/components/account-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/95 supports-[backdrop-filter]:bg-background/85 supports-[backdrop-filter]:backdrop-blur-sm">
      <div className="mx-auto grid h-16 w-full max-w-[128rem] grid-cols-[1fr_auto] items-center px-5 sm:grid-cols-[1fr_auto_1fr] sm:px-8">
        <Link className="group flex items-center gap-3" href="/" aria-label="焚诀首页">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center border border-primary/70 font-serif text-lg text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
          >
            焚
          </span>
          <span className="font-serif text-lg tracking-[0.08em]">焚诀</span>
        </Link>

        <p className="hidden justify-self-center text-xs tracking-[0.16em] text-muted-foreground sm:block">
          卷一 · 文生图
        </p>

        <div className="flex items-center justify-self-end gap-3 text-sm text-muted-foreground sm:gap-4">
          <Link
            className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            href="/collections"
          >
            专栏
          </Link>
          <Suspense fallback={<AccountMenuFallback />}>
            <AccountMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
