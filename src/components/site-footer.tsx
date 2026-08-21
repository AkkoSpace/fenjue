import { GitFork } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70">
      <div className="mx-auto flex min-h-14 w-full max-w-[90rem] items-center justify-between gap-4 px-5 text-xs text-muted-foreground sm:px-8">
        <p className="min-w-0 truncate">
          <span className="font-serif text-foreground">焚诀</span>
          <span> · 以图为引，得其法。</span>
          <span className="hidden md:inline">
            {" "}内容来自公开网络，仅作灵感整理。
          </span>
        </p>
        <a
          className="inline-flex min-h-11 shrink-0 items-center gap-2 px-1 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          href="https://github.com/AkkoSpace/fenjue"
          target="_blank"
          rel="noreferrer"
        >
          <GitFork className="size-4" aria-hidden="true" />
          GitHub
          <span className="sr-only">（在新窗口打开）</span>
        </a>
      </div>
    </footer>
  );
}
