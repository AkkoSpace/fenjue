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
    "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-sm px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9",
    active
      ? "bg-foreground text-background"
      : "text-muted-foreground hover:bg-muted hover:text-foreground",
  );
}

export function PromptFilters({
  activeCategory,
  activeTag,
  categories,
  categoryAllCount,
  filteredCount,
  tagAllCount,
  tags,
}: PromptFiltersProps) {
  const filtered = Boolean(activeCategory || activeTag);

  return (
    <section aria-label="作品筛选" className="mb-8 border-y border-border/80 py-3 sm:mb-10">
      <div className="grid gap-2 lg:grid-cols-[3rem_minmax(0,1fr)] lg:items-center">
        <p className="font-serif text-xs text-primary">门类</p>
        <nav
          aria-label="按分类筛选"
          className="flex gap-1 overflow-x-auto pb-1 pr-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0 sm:pr-0"
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

      <div className="mt-2 grid gap-2 border-t border-border/60 pt-2 lg:grid-cols-[3rem_minmax(0,1fr)] lg:items-center">
        <p className="font-serif text-xs text-primary">标签</p>
        <nav
          aria-label="按标签筛选"
          className="flex gap-1 overflow-x-auto overscroll-x-contain pb-1 pr-6 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      </div>

      {filtered ? (
        <div className="mt-3 flex items-center justify-between gap-4 border-t border-border/60 pt-3 text-xs text-muted-foreground">
          <p>
            当前找到 <span className="font-medium text-foreground">{filteredCount}</span> 条作品
          </p>
          <Link
            className="inline-flex min-h-11 items-center text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9"
            href="/"
            prefetch={false}
          >
            清除筛选
          </Link>
        </div>
      ) : null}
    </section>
  );
}
