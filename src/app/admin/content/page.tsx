import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  ImageIcon,
  PencilLine,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { AdminNotice, firstMessage } from "@/components/admin/admin-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { DeletePromptForm } from "@/components/admin/delete-prompt-form";
import { PromptReviewBadge } from "@/components/prompt-review-badge";
import { SensitiveImageGuard } from "@/components/sensitive-image-guard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type AdminPromptQuality,
  type AdminPromptSearchParams,
  type AdminPromptStatus,
  getAdminPrompts,
} from "@/lib/admin/queries";
import { getContentTaxonomy } from "@/lib/content/queries";
import { getContentRelationOption } from "@/lib/content/relation";
import { hasR2WriteConfig } from "@/lib/r2/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  description: "搜索、审核、编辑与删除焚诀作品。",
  title: { absolute: "内容管理｜焚诀" },
};

interface ContentPageProps {
  searchParams: Promise<
    AdminPromptSearchParams & {
      error?: string | string[];
      success?: string | string[];
      warning?: string | string[];
    }
  >;
}

interface ContentHrefOptions {
  category?: string;
  page?: number;
  quality?: AdminPromptQuality;
  query?: string;
  status?: AdminPromptStatus;
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" });

function contentHref({
  category = "",
  page = 1,
  quality = "all",
  query = "",
  status = "all",
}: ContentHrefOptions) {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (query) params.set("q", query);
  if (quality !== "all") params.set("quality", quality);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/admin/content${search ? `?${search}` : ""}` as Route;
}

function reviewHref(id: string, options: ContentHrefOptions) {
  const listUrl = new URL(contentHref(options), "https://fenjue.local");
  return `/admin/content/${id}/edit${listUrl.search}` as Route;
}

function ContentFallback() {
  return (
    <main>
      <div className="h-24 animate-pulse bg-muted/40" />
      <div className="mt-8 h-14 animate-pulse border-y border-border bg-muted/40" />
      <div className="mt-8 space-y-px bg-border">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="h-28 animate-pulse bg-background" key={index} />
        ))}
      </div>
    </main>
  );
}

function AdminCover({
  prompt,
}: {
  prompt: Awaited<ReturnType<typeof getAdminPrompts>>["items"][number];
}) {
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-muted">
      {prompt.cover ? (
        <Image
          alt={prompt.cover.alt}
          className="object-cover"
          fill
          sizes="96px"
          src={prompt.cover.src}
        />
      ) : (
        <div className="grid size-full place-items-center text-muted-foreground">
          <ImageIcon aria-hidden="true" className="size-5" />
        </div>
      )}
      {prompt.imageCount > 1 ? (
        <span className="absolute bottom-1 right-1 bg-foreground/85 px-1.5 py-0.5 text-[0.6875rem] text-background">
          {prompt.imageCount} 图
        </span>
      ) : null}
    </div>
  );
}

export default function AdminContentPage(props: ContentPageProps) {
  return (
    <Suspense fallback={<ContentFallback />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ searchParams }: ContentPageProps) {
  const raw = await searchParams;
  const [data, taxonomy] = await Promise.all([
    getAdminPrompts(raw),
    getContentTaxonomy(),
  ]);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const message = firstMessage(raw.error)
    ? { kind: "error" as const, text: firstMessage(raw.error)! }
    : firstMessage(raw.warning)
      ? { kind: "warning" as const, text: firstMessage(raw.warning)! }
      : firstMessage(raw.success)
        ? { kind: "success" as const, text: firstMessage(raw.success)! }
        : undefined;
  const canDelete = hasR2WriteConfig();
  const statusOptions: {
    count: number;
    label: string;
    value: AdminPromptStatus;
  }[] = [
    { count: data.counts.all, label: "全部", value: "all" },
    { count: data.counts.pending, label: "待审核", value: "pending" },
    { count: data.counts.approved, label: "已通过", value: "approved" },
    { count: data.counts.rejected, label: "已驳回", value: "rejected" },
  ];

  return (
    <main>
      <AdminPageHeader
        action={
          <Link
            className={cn(buttonVariants({ size: "lg" }), "min-h-11 rounded-sm")}
            href="/submit"
          >
            <Upload aria-hidden="true" />
            上传作品
          </Link>
        }
        description="逐条检查作品、来源与图片；只有审核通过的内容才会公开展示。"
        eyebrow="Content · 内容"
        title="内容管理"
      />

      {message ? <AdminNotice kind={message.kind} text={message.text} /> : null}
      {data.error ? <AdminNotice kind="error" text={data.error} /> : null}

      <section aria-labelledby="prompt-management-heading" className="mt-8">
        <h2 className="sr-only" id="prompt-management-heading">作品列表</h2>
        <div className="border-y border-border py-4">
          <nav aria-label="作品状态" className="flex flex-wrap gap-1">
            {statusOptions.map((option) => (
              <Link
                aria-current={data.status === option.value ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center gap-2 rounded-sm px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9",
                  data.status === option.value
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                href={contentHref({
                  category: data.category,
                  quality: data.quality,
                  query: data.query,
                  status: option.value,
                })}
                key={option.value}
              >
                {option.label}
                <span className="text-xs tabular-nums opacity-70">{option.count}</span>
              </Link>
            ))}
          </nav>

          <form
            className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-[12rem_14rem_minmax(18rem,1fr)_auto] xl:items-end"
            method="get"
          >
            {data.status !== "all" ? (
              <input name="status" type="hidden" value={data.status} />
            ) : null}

            <label className="grid gap-1.5 text-xs text-muted-foreground">
              资料状态
              <select
                className="min-h-11 rounded-sm border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                defaultValue={data.quality}
                name="quality"
              >
                <option value="all">全部资料</option>
                <option value="ready">导入完整</option>
                <option value="needs_review">需要人工复核</option>
                <option value="missing_media">缺少图片</option>
              </select>
            </label>

            <label className="grid gap-1.5 text-xs text-muted-foreground">
              主分类
              <select
                className="min-h-11 rounded-sm border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                defaultValue={data.category}
                name="category"
              >
                <option value="">全部分类</option>
                {taxonomy.categories.map((category) => (
                  <option key={category.key} value={category.key}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs text-muted-foreground sm:col-span-2 xl:col-span-1">
              搜索
              <span className="relative block min-w-0">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="搜索作品"
                  className="pl-9"
                  defaultValue={data.query}
                  maxLength={80}
                  name="q"
                  placeholder="标题、作者或作品编号"
                  type="search"
                />
              </span>
            </label>

            <div className="flex min-h-11 items-center gap-2 sm:col-span-2 xl:col-span-1">
              <Button className="min-h-11 flex-1 rounded-sm xl:flex-none" type="submit" variant="outline">
                搜索与筛选
              </Button>
              {data.query || data.category || data.quality !== "all" ? (
                <Link
                  aria-label="清除筛选"
                  className={cn(buttonVariants({ size: "icon", variant: "ghost" }), "size-11 shrink-0 rounded-sm")}
                  href={contentHref({ status: data.status })}
                  title="清除筛选"
                >
                  <RotateCcw aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </form>
        </div>

        <div className="flex items-baseline justify-between gap-4 py-5">
          <p className="text-sm text-muted-foreground">
            找到 <span className="font-medium text-foreground">{data.total}</span> 条作品
          </p>
          {!canDelete ? <p className="hidden text-xs text-muted-foreground md:block">配置 R2 写入凭据后可永久删除</p> : null}
        </div>

        {data.items.length ? (
          <div className="divide-y divide-border border-y border-border">
            {data.items.map((prompt) => (
              <article
                className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-4 py-5 xl:grid-cols-[6rem_minmax(13rem,1.5fr)_8rem_minmax(16rem,auto)] xl:items-center xl:gap-x-6"
                key={prompt.id}
              >
                {prompt.isNsfw ? (
                  <SensitiveImageGuard compact title={prompt.title}><AdminCover prompt={prompt} /></SensitiveImageGuard>
                ) : <AdminCover prompt={prompt} />}

                <div className="min-w-0 self-center">
                  <h3 className="truncate text-sm font-medium text-foreground sm:text-base">{prompt.title}</h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">{prompt.authorName}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground/80">
                    {prompt.slug} · {getContentRelationOption(prompt.contentRelation).label} · {prompt.category.name}
                    {prompt.tags.length ? ` · ${prompt.tags.map((tag) => `#${tag.name}`).join(" ")}` : ""}
                    {prompt.verifiedTools.length ? ` · ${prompt.verifiedTools.map((tool) => tool.name).join(" / ")}` : ""}
                    {prompt.isNsfw ? " · NSFW" : ""}
                  </p>
                  {prompt.importStatus === "needs_review" || prompt.importStatus === "missing_media" ? (
                    <p className="mt-2 text-xs text-destructive">
                      {prompt.importStatus === "missing_media" ? "缺少图片" : "导入资料需要人工复核"}
                      {prompt.importNote ? ` · ${prompt.importNote}` : ""}
                    </p>
                  ) : null}
                </div>

                <div className="col-start-2 xl:col-start-auto">
                  <PromptReviewBadge status={prompt.reviewStatus} />
                  <p className="mt-1 text-xs text-muted-foreground">{dateFormatter.format(new Date(prompt.createdAt))}</p>
                </div>

                <div className="col-span-2 flex flex-wrap items-center gap-2 xl:col-span-1 xl:justify-end">
                  <Link
                    className={cn(buttonVariants({ size: "sm", variant: "outline" }), "min-h-11 rounded-sm sm:min-h-9")}
                    href={reviewHref(prompt.id, {
                      category: data.category,
                      page: data.status === "all" ? 1 : data.page,
                      quality: data.quality,
                      query: data.query,
                      status: data.status === "all" ? prompt.reviewStatus : data.status,
                    })}
                  >
                    <PencilLine aria-hidden="true" />
                    {prompt.reviewStatus === "pending" ? "审核" : "查看与编辑"}
                  </Link>
                  {prompt.reviewStatus === "approved" && prompt.published ? (
                    <Link
                      className={cn(buttonVariants({ size: "icon-sm", variant: "ghost" }), "size-11 rounded-sm sm:size-9")}
                      href={`/prompts/${prompt.slug}` as Route}
                      title="查看公开页面"
                    >
                      <ExternalLink aria-hidden="true" /><span className="sr-only">查看公开页面</span>
                    </Link>
                  ) : null}
                  <DeletePromptForm
                    canDelete={canDelete}
                    id={prompt.id}
                    returnTo={contentHref({
                      category: data.category,
                      page: data.page,
                      quality: data.quality,
                      query: data.query,
                      status: data.status,
                    })}
                    title={prompt.title}
                  />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border-y border-border py-16 text-center">
            <ImageIcon aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
            <h3 className="mt-4 font-serif text-xl text-foreground">没有符合条件的作品</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {data.query || data.category || data.quality !== "all"
                ? "调整关键词或清除当前筛选。"
                : "上传第一条作品后会出现在这里。"}
            </p>
          </div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="作品分页" className="mt-6 flex items-center justify-between border-t border-border pt-5">
            {data.page > 1 ? (
              <Link className={cn(buttonVariants({ variant: "outline" }), "min-h-11 rounded-sm")} href={contentHref({ category: data.category, page: data.page - 1, quality: data.quality, query: data.query, status: data.status })}>
                <ArrowLeft aria-hidden="true" />上一页
              </Link>
            ) : <span />}
            <span className="text-sm tabular-nums text-muted-foreground">{data.page} / {totalPages}</span>
            {data.page < totalPages ? (
              <Link className={cn(buttonVariants({ variant: "outline" }), "min-h-11 rounded-sm")} href={contentHref({ category: data.category, page: data.page + 1, quality: data.quality, query: data.query, status: data.status })}>
                下一页<ArrowRight aria-hidden="true" />
              </Link>
            ) : <span />}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
