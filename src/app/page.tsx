import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { FeaturedPrompts } from "@/components/featured-prompts";
import { PageShell } from "@/components/layout/page-shell";
import { PromptEntry } from "@/components/prompt-entry";
import { PromptFilters } from "@/components/prompt-filters";
import { buttonVariants } from "@/components/ui/button";
import {
  getPromptPage,
  type PromptPageData,
} from "@/lib/content/queries";
import { getFeaturedPrompts } from "@/lib/content/editorial-queries";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { cn } from "@/lib/utils";

import styles from "./home.module.css";

export const instant = false;

interface HomeProps {
  searchParams: Promise<{
    category?: string | string[];
    page?: string | string[];
    tag?: string | string[];
  }>;
}

type HomeSearchParams = Awaited<HomeProps["searchParams"]>;

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

function pageRequest(raw: HomeSearchParams) {
  return {
    categoryKey: first(raw.category),
    page: parsePage(first(raw.page)),
    tagKey: first(raw.tag),
  };
}

function activeName(
  options: { key: string; name: string }[],
  key?: string,
) {
  return options.find((option) => option.key === key)?.name;
}

function listingCopy(data: PromptPageData) {
  const categoryName = activeName(data.categories, data.activeCategory);
  const tagName = activeName(data.tags, data.activeTag);
  const scope = [categoryName, tagName].filter(Boolean).join(" · ");
  const heading = scope ? `${scope} AI 文生图提示词` : "AI 文生图提示词精选";
  const title = data.page > 1 ? `${heading}｜第 ${data.page} 页` : heading;
  const description = scope
    ? `浏览焚诀精选的${scope}文生图案例，查看参考图片并复制完整提示词，前往常用 AI 工具重新生成。`
    : "浏览焚诀精选的 AI 文生图案例，查看参考图片并复制完整提示词，支持 Nano Banana、豆包、ChatGPT 与 Grok。";

  return { description, heading, title };
}

function hasInvalidFacet(raw: HomeSearchParams, data: PromptPageData) {
  const requestedCategory = first(raw.category);
  const requestedTag = first(raw.tag);

  return Boolean(
    (requestedCategory && requestedCategory !== data.activeCategory) ||
      (requestedTag && requestedTag !== data.activeTag),
  );
}

async function loadPage(searchParams: HomeProps["searchParams"]) {
  const raw = await searchParams;
  const data = await getPromptPage(pageRequest(raw));

  return { data, raw };
}

export async function generateMetadata({
  searchParams,
}: HomeProps): Promise<Metadata> {
  const { data, raw } = await loadPage(searchParams);
  const copy = listingCopy(data);
  const canonical = pageHref(
    data.page,
    data.activeCategory,
    data.activeTag,
  );
  const cover = data.entries[0]?.images[0];
  const indexable =
    !hasInvalidFacet(raw, data) &&
    !(data.activeCategory && data.activeTag) &&
    data.page <= data.totalPages;
  const images = cover?.src
    ? [
        {
          alt: cover.alt,
          height: cover.height,
          url: cover.src,
          width: cover.width,
        },
      ]
    : undefined;

  return {
    alternates: { canonical },
    description: copy.description,
    openGraph: {
      description: copy.description,
      images,
      title: copy.title,
      type: "website",
      url: canonical,
    },
    robots: { follow: true, index: indexable },
    title: { absolute: `${copy.title} · ${SITE_NAME}` },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      description: copy.description,
      images: cover?.src ? [cover.src] : undefined,
      title: copy.title,
    },
  };
}

export default async function Home({ searchParams }: HomeProps) {
  const { data } = await loadPage(searchParams);

  if (data.page > data.totalPages) {
    notFound();
  }

  const copy = listingCopy(data);
  const featured =
    data.page === 1 && !data.activeCategory && !data.activeTag
      ? await getFeaturedPrompts()
      : [];
  const canonical = pageHref(
    data.page,
    data.activeCategory,
    data.activeTag,
  );
  const itemList = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    description: copy.description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: data.entries.map((entry, index) => ({
        "@type": "ListItem",
        image: entry.images[0]?.src,
        name: entry.title,
        position: (data.page - 1) * data.pageSize + index + 1,
        url: absoluteUrl(`/prompts/${entry.slug}`),
      })),
      numberOfItems: data.filteredCount,
    },
    name: copy.title,
    url: absoluteUrl(canonical),
  };

  return (
    <PageShell className="pb-20 pt-7 sm:pt-9" width="wide">
      <JsonLd data={itemList} />
      <div className={styles.shell}>
        <header className={styles.intro}>
          <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Prompt Collection · 01
          </p>
          <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">
            {copy.heading}
          </h1>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border/80 pb-5">
            <p className="max-w-lg text-sm leading-6 text-muted-foreground">
              看见喜欢的画面，复制提示词，去你常用的 AI 工具里重新生成。
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {data.filteredCount.toLocaleString("zh-CN")} 式
            </p>
          </div>
        </header>

        <PromptFilters
          activeCategory={data.activeCategory}
          activeTag={data.activeTag}
          categories={data.categories}
          categoryAllCount={data.categoryAllCount}
          className={styles.filters}
          filteredCount={data.filteredCount}
          tagAllCount={data.tagAllCount}
          tags={data.tags}
        />

        <FeaturedPrompts
          className={styles.featured}
          items={featured}
        />

        <section aria-label={copy.heading} className={styles.feed}>
          {data.entries.length ? (
            data.entries.map((entry, index) => (
              <PromptEntry
                eager={index === 0}
                key={entry.slug}
                entry={entry}
              />
            ))
          ) : (
            <div className="border-y border-border py-16 text-center">
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
            className={cn(
              styles.pagination,
              "flex items-center justify-between gap-4 border-t border-border pt-6",
            )}
          >
            {data.page > 1 ? (
              <Link
                className={cn(buttonVariants({ variant: "outline" }), "rounded-sm")}
                href={pageHref(
                  data.page - 1,
                  data.activeCategory,
                  data.activeTag,
                )}
                rel="prev"
              >
                <ArrowLeft aria-hidden="true" />
                上一页
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm tabular-nums text-muted-foreground">
              第 {data.page} / {data.totalPages} 页
            </span>
            {data.page < data.totalPages ? (
              <Link
                className={cn(buttonVariants({ variant: "outline" }), "rounded-sm")}
                href={pageHref(
                  data.page + 1,
                  data.activeCategory,
                  data.activeTag,
                )}
                rel="next"
              >
                下一页
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </div>
    </PageShell>
  );
}
