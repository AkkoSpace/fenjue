import type { Route } from "next";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface FilterOption {
  count: number;
  key: string;
  name: string;
}

interface PromptFiltersProps {
  activeCategory?: string;
  activeTag?: string;
  categories: FilterOption[];
  categoryAllCount: number;
  className?: string;
  filteredCount: number;
  tagAllCount: number;
  tags: FilterOption[];
}

function filterHref(category?: string, tag?: string) {
  const params = new URLSearchParams();

  if (category) params.set("category", category);
  if (tag) params.set("tag", tag);

  const search = params.toString();
  return `/${search ? `?${search}` : ""}` as Route;
}

function filterLinkClassName(active: boolean) {
  return cn(
    "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9 min-[128rem]:w-full min-[128rem]:justify-between min-[128rem]:px-2.5",
    active
      ? "bg-foreground text-background min-[128rem]:bg-primary/10 min-[128rem]:text-primary"
      : "text-muted-foreground hover:bg-muted hover:text-foreground min-[128rem]:hover:bg-muted/70",
  );
}

export function PromptFilters({
  activeCategory,
  activeTag,
  categories,
  categoryAllCount,
  className,
  filteredCount,
  tagAllCount,
  tags,
}: PromptFiltersProps) {
  const filtered = Boolean(activeCategory || activeTag);
  const primaryTags = tags.slice(0, 8);
  const remainingTags = tags.slice(8);

  return (
    <aside
      aria-label="发现与筛选"
      className={cn(
        "border-y border-border/80 py-3 min-[128rem]:border-y-0 min-[128rem]:py-0",
        className,
      )}
    >
      <div className="hidden min-[128rem]:block min-[128rem]:pb-6">
        <p className="mb-2 text-[0.68rem] font-medium tracking-[0.18em] text-primary uppercase">
          Explore · 发现
        </p>
        <nav aria-label="主要导航" className="grid gap-1 text-sm">
          <Link
            aria-current="page"
            className="flex min-h-10 items-center justify-between rounded-sm bg-foreground px-3 text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            href="/"
          >
            作品流
            <span className="text-xs opacity-60">壹</span>
          </Link>
          <Link
            className="flex min-h-10 items-center justify-between rounded-sm px-3 text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            href="/collections"
          >
            专栏
            <span className="text-xs opacity-60">辑</span>
          </Link>
        </nav>
      </div>

      <div className="min-[128rem]:sticky min-[128rem]:top-24">
        <div className="grid gap-2 lg:grid-cols-[3rem_minmax(0,1fr)] lg:items-center min-[128rem]:block">
          <div className="flex items-baseline justify-between min-[128rem]:mb-2">
            <p className="font-serif text-xs text-primary">门类</p>
            <span className="hidden text-[0.68rem] tabular-nums text-muted-foreground min-[128rem]:inline">
              {categoryAllCount.toLocaleString("zh-CN")}
            </span>
          </div>
        <nav
          aria-label="按分类筛选"
          className="flex gap-1 overflow-x-auto pb-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0 sm:pr-0 min-[128rem]:grid min-[128rem]:gap-1"
        >
          <Link
            aria-current={!activeCategory ? "page" : undefined}
            className={filterLinkClassName(!activeCategory)}
            href={filterHref(undefined, activeTag)}
            prefetch={false}
          >
            全部
            <span className="text-xs opacity-65">{categoryAllCount}</span>
          </Link>
          {categories.map((category) => (
            <Link
              aria-current={activeCategory === category.key ? "page" : undefined}
              className={filterLinkClassName(activeCategory === category.key)}
              href={filterHref(category.key, activeTag)}
              key={category.key}
              prefetch={false}
            >
              {category.name}
              <span className="text-xs opacity-65">{category.count}</span>
            </Link>
          ))}
        </nav>
      </div>

        <div className="mt-2 grid gap-2 border-t border-border/60 pt-2 lg:grid-cols-[3rem_minmax(0,1fr)] lg:items-center min-[128rem]:mt-6 min-[128rem]:block min-[128rem]:pt-5">
          <div className="flex items-baseline justify-between min-[128rem]:mb-2">
            <p className="font-serif text-xs text-primary">标签</p>
            <span className="hidden text-[0.68rem] tabular-nums text-muted-foreground min-[128rem]:inline">
              {tagAllCount.toLocaleString("zh-CN")}
            </span>
          </div>
        <nav
          aria-label="按标签筛选"
          className="flex gap-1 overflow-x-auto overscroll-x-contain pb-1 pr-6 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden min-[128rem]:hidden"
        >
          <Link
            aria-current={!activeTag ? "page" : undefined}
            className={filterLinkClassName(!activeTag)}
            href={filterHref(activeCategory)}
            prefetch={false}
          >
            全部标签
            <span className="text-xs opacity-65">{tagAllCount}</span>
          </Link>
          {tags.map((tag) => (
            <Link
              aria-current={activeTag === tag.key ? "page" : undefined}
              className={filterLinkClassName(activeTag === tag.key)}
              href={filterHref(activeCategory, tag.key)}
              key={tag.key}
              prefetch={false}
            >
              #{tag.name}
              <span className="text-xs opacity-65">{tag.count}</span>
            </Link>
          ))}
        </nav>

          <nav aria-label="按常用标签筛选" className="hidden min-[128rem]:grid min-[128rem]:gap-1">
            <Link
              aria-current={!activeTag ? "page" : undefined}
              className={filterLinkClassName(!activeTag)}
              href={filterHref(activeCategory)}
              prefetch={false}
            >
              全部标签
              <span className="text-xs opacity-65">{tagAllCount}</span>
            </Link>
            {primaryTags.map((tag) => (
              <Link
                aria-current={activeTag === tag.key ? "page" : undefined}
                className={filterLinkClassName(activeTag === tag.key)}
                href={filterHref(activeCategory, tag.key)}
                key={tag.key}
                prefetch={false}
              >
                <span>#{tag.name}</span>
                <span className="text-xs opacity-65">{tag.count}</span>
              </Link>
            ))}
          </nav>

          {remainingTags.length ? (
            <details className="group mt-1 hidden min-[128rem]:block" open={Boolean(activeTag && remainingTags.some((tag) => tag.key === activeTag))}>
              <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between rounded-sm px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
                更多标签
                <span aria-hidden="true" className="text-xs transition-transform group-open:rotate-45">＋</span>
              </summary>
              <nav aria-label="更多标签" className="mt-1 grid gap-1 border-l border-border pl-2">
                {remainingTags.map((tag) => (
                  <Link
                    aria-current={activeTag === tag.key ? "page" : undefined}
                    className={filterLinkClassName(activeTag === tag.key)}
                    href={filterHref(activeCategory, tag.key)}
                    key={tag.key}
                    prefetch={false}
                  >
                    <span>#{tag.name}</span>
                    <span className="text-xs opacity-65">{tag.count}</span>
                  </Link>
                ))}
              </nav>
            </details>
          ) : null}
      </div>

      {filtered ? (
          <div className="mt-3 flex items-center justify-between gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground min-[128rem]:mt-6 min-[128rem]:block min-[128rem]:pt-5">
          <p>
            当前找到 <span className="font-medium text-foreground">{filteredCount}</span> 条作品
          </p>
          <Link
              className="inline-flex min-h-11 items-center text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9 min-[128rem]:mt-1"
            href="/"
            prefetch={false}
          >
            清除筛选
          </Link>
        </div>
      ) : null}
      </div>
    </aside>
  );
}
