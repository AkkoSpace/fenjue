import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { PromptEntry } from "@/components/prompt-entry";
import { PromptFilters } from "@/components/prompt-filters";
import { getPromptPage } from "@/lib/content/queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const instant = false;

interface HomeProps {
  searchParams: Promise<{
    category?: string | string[];
    page?: string | string[];
    tag?: string | string[];
  }>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

function pageHref(page: number, category?: string, tag?: string) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (tag) params.set("tag", tag);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/${search ? `?${search}` : ""}` as Route;
}

export default async function Home({ searchParams }: HomeProps) {
  const raw = await searchParams;
  const data = await getPromptPage({
    categoryKey: first(raw.category),
    page: parsePage(first(raw.page)),
    tagKey: first(raw.tag),
  });

  return (
    <main className="mx-auto w-full max-w-[90rem] px-5 pb-20 pt-8 sm:px-8 sm:pt-10">
      <div className="mb-9 max-w-2xl sm:mb-11">
        <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
          Prompt Collection · 01
        </p>
        <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">
          文生图
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          看见喜欢的画面，复制提示词，去你常用的 AI 工具里重新生成。
        </p>
      </div>

      <PromptFilters
        activeCategory={data.activeCategory}
        activeTag={data.activeTag}
        categories={data.categories}
        categoryAllCount={data.categoryAllCount}
        filteredCount={data.filteredCount}
        tagAllCount={data.tagAllCount}
        tags={data.tags}
      />

      <section
        aria-label="精选文生图提示词"
        className="columns-1 gap-6 md:columns-2 2xl:columns-3"
      >
        {data.entries.length ? (
          data.entries.map((entry) => (
            <PromptEntry key={entry.slug} entry={entry} />
          ))
        ) : (
          <div className="break-inside-avoid border-y border-border py-16 text-center">
            <h2 className="font-serif text-xl text-foreground">没有符合条件的作品</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              试试其他分类或标签，也可以清除当前筛选。
            </p>
          </div>
        )}
      </section>

      {data.totalPages > 1 ? (
        <nav
          aria-label="作品分页"
          className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-6 sm:mt-8"
        >
          {data.page > 1 ? (
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "rounded-sm")}
              href={pageHref(
                data.page - 1,
                data.activeCategory,
                data.activeTag,
              )}
            >
              <ArrowLeft aria-hidden="true" />
              上一页
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm tabular-nums text-muted-foreground">
            第 {Math.min(data.page, data.totalPages)} / {data.totalPages} 页
          </span>
          {data.page < data.totalPages ? (
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "rounded-sm")}
              href={pageHref(
                data.page + 1,
                data.activeCategory,
                data.activeTag,
              )}
            >
              下一页
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </main>
  );
}
