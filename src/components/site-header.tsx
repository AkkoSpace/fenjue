import { GitFork } from "lucide-react";
import Link from "next/link";

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
          <a
            className="inline-flex min-h-11 items-center gap-2 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            href="https://github.com/AkkoSpace/fenjue"
            target="_blank"
            rel="noreferrer"
          >
            <GitFork className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">GitHub</span>
            <span className="sr-only">在新窗口打开 GitHub 仓库</span>
          </a>
        </div>
      </div>
    </header>
  );
}
