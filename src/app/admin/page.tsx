import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  ExternalLink,
  ImageIcon,
  RotateCcw,
  Search,
  Upload,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { DeletePromptForm } from "@/components/admin/delete-prompt-form";
import { SensitiveImageGuard } from "@/components/sensitive-image-guard";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setPromptPublication } from "@/lib/admin/actions";
import {
  type AdminPromptSearchParams,
  type AdminPromptStatus,
  getAdminPrompts,
} from "@/lib/admin/queries";
import { getContentRelationOption } from "@/lib/content/relation";
import { hasR2WriteConfig } from "@/lib/r2/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "内容管理 · 焚诀",
  description: "管理焚诀全站文生图作品。",
};

interface AdminPageProps {
  searchParams: Promise<
    AdminPromptSearchParams & {
      error?: string | string[];
      success?: string | string[];
      warning?: string | string[];
    }
  >;
}

interface AdminHrefOptions {
  page?: number;
  query?: string;
  status?: AdminPromptStatus;
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function adminHref({ page = 1, query = "", status = "all" }: AdminHrefOptions) {
  const params = new URLSearchParams();

  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));

  const search = params.toString();
  return `/admin${search ? `?${search}` : ""}` as Route;
}

function AdminFallback() {
  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-5 pb-20 pt-8 sm:px-8 sm:pt-10">
      <div className="h-9 w-52 animate-pulse bg-muted" />
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

export default function AdminPage(props: AdminPageProps) {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminContent {...props} />
    </Suspense>
  );
}

async function AdminContent({ searchParams }: AdminPageProps) {
  const raw = await searchParams;
  const data = await getAdminPrompts(raw);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const returnTo = adminHref({
    page: data.page,
    query: data.query,
    status: data.status,
  });
  const message = first(raw.error)
    ? { kind: "error" as const, text: first(raw.error)! }
    : first(raw.warning)
      ? { kind: "warning" as const, text: first(raw.warning)! }
      : first(raw.success)
        ? { kind: "success" as const, text: first(raw.success)! }
        : undefined;
  const canDelete = hasR2WriteConfig();

  const statusOptions: {
    count: number;
    label: string;
    value: AdminPromptStatus;
  }[] = [
    { count: data.counts.all, label: "全部", value: "all" },
    { count: data.counts.published, label: "展示中", value: "published" },
    { count: data.counts.hidden, label: "已下架", value: "hidden" },
  ];

  return (
    <main className="mx-auto w-full max-w-[90rem] flex-1 px-5 pb-20 pt-8 sm:px-8 sm:pt-10">
      <div className="flex flex-col justify-between gap-6 border-b border-border pb-7 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
            Administration · 管理
          </p>
          <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">
            内容管理
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {data.profile.display_name || "管理员"}，在这里维护全站公开作品。
          </p>
        </div>

        <Link
          className={cn(
            buttonVariants({ size: "lg" }),
            "min-h-11 self-start rounded-sm md:self-auto",
          )}
          href="/submit"
        >
          <Upload aria-hidden="true" />
          上传作品
        </Link>
      </div>

      {message ? (
        <div
          className={cn(
            "mt-6 border px-4 py-3 text-sm leading-6",
            message.kind === "error" &&
              "border-destructive/30 bg-destructive/5 text-destructive",
            message.kind === "success" &&
              "border-emerald-700/25 bg-emerald-700/5 text-emerald-800",
            message.kind === "warning" &&
              "border-amber-700/25 bg-amber-700/5 text-amber-900",
          )}
          role={message.kind === "error" ? "alert" : "status"}
        >
          {message.text}
        </div>
      ) : null}

      {data.error ? (
        <div
          className="mt-6 border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          {data.error}
        </div>
      ) : null}

      <section aria-labelledby="prompt-management-heading" className="mt-8">
        <h2 className="sr-only" id="prompt-management-heading">
          作品列表
        </h2>

        <div className="flex flex-col gap-4 border-y border-border py-4 lg:flex-row lg:items-center lg:justify-between">
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
                href={adminHref({ query: data.query, status: option.value })}
                key={option.value}
              >
                {option.label}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    data.status === option.value
                      ? "text-background/70"
                      : "text-muted-foreground",
                  )}
                >
                  {option.count}
                </span>
              </Link>
            ))}
          </nav>

          <form className="flex w-full gap-2 lg:max-w-md" method="get">
            {data.status !== "all" ? (
              <input name="status" type="hidden" value={data.status} />
            ) : null}
            <div className="relative min-w-0 flex-1">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="搜索作品"
                className="pl-9"
                defaultValue={data.query}
                maxLength={80}
                name="q"
                placeholder="搜索标题、作者或作品编号"
                type="search"
              />
            </div>
            <Button className="min-h-11 rounded-sm" type="submit" variant="outline">
              搜索
            </Button>
            {data.query ? (
              <Link
                aria-label="清除搜索"
                className={cn(
                  buttonVariants({ size: "icon", variant: "ghost" }),
                  "size-11 rounded-sm",
                )}
                href={adminHref({ status: data.status })}
                title="清除搜索"
              >
                <RotateCcw aria-hidden="true" />
              </Link>
            ) : null}
          </form>
        </div>

        <div className="flex items-baseline justify-between gap-4 py-5">
          <p className="text-sm text-muted-foreground">
            找到 <span className="font-medium text-foreground">{data.total}</span> 条作品
          </p>
          {!canDelete ? (
            <p className="hidden text-xs text-muted-foreground md:block">
              配置 R2 写入凭据后可永久删除
            </p>
          ) : null}
        </div>

        {data.items.length ? (
          <div className="divide-y divide-border border-y border-border">
            {data.items.map((prompt) => (
              <article
                className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-4 gap-y-4 py-5 md:grid-cols-[6rem_minmax(12rem,1.5fr)_minmax(8rem,0.7fr)_7rem_auto] md:items-center md:gap-x-6"
                key={prompt.id}
              >
                {prompt.isNsfw ? (
                  <SensitiveImageGuard compact title={prompt.title}>
                    <AdminCover prompt={prompt} />
                  </SensitiveImageGuard>
                ) : (
                  <AdminCover prompt={prompt} />
                )}

                <div className="min-w-0 self-center">
                  <h3 className="truncate text-sm font-medium text-foreground sm:text-base">
                    {prompt.title}
                  </h3>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {prompt.authorName}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground/80">
                    {prompt.slug} · {getContentRelationOption(prompt.contentRelation).label}
                    {prompt.isNsfw ? " · NSFW" : ""}
                  </p>
                </div>

                <div className="col-start-2 min-w-0 md:col-start-auto">
                  <p className="flex items-center gap-2 text-sm text-foreground">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-1.5 rounded-full",
                        prompt.published ? "bg-emerald-600" : "bg-muted-foreground",
                      )}
                    />
                    {prompt.published ? "展示中" : "已下架"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {dateFormatter.format(new Date(prompt.createdAt))}
                  </p>
                </div>

                <div className="col-start-2 flex items-center gap-3 md:col-start-auto">
                  {prompt.published ? (
                    <Link
                      className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9"
                      href={`/prompts/${prompt.slug}` as Route}
                    >
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                      查看
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground/70">不可公开查看</span>
                  )}
                </div>

                <div className="col-span-2 flex flex-wrap items-center gap-2 md:col-span-1 md:justify-end">
                  <form action={setPromptPublication}>
                    <input name="id" type="hidden" value={prompt.id} />
                    <input
                      name="published"
                      type="hidden"
                      value={String(!prompt.published)}
                    />
                    <input name="returnTo" type="hidden" value={returnTo} />
                    <ActionButton
                      className="min-h-11 rounded-sm sm:min-h-9"
                      pendingLabel="处理中"
                      size="sm"
                      type="submit"
                      variant="outline"
                    >
                      {prompt.published ? (
                        <EyeOff data-icon="inline-start" aria-hidden="true" />
                      ) : (
                        <Eye data-icon="inline-start" aria-hidden="true" />
                      )}
                      {prompt.published ? "下架" : "恢复"}
                    </ActionButton>
                  </form>

                  <DeletePromptForm
                    canDelete={canDelete}
                    id={prompt.id}
                    returnTo={returnTo}
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
              {data.query ? "换一个关键词，或清除当前筛选。" : "上传第一条作品后会出现在这里。"}
            </p>
          </div>
        )}

        {totalPages > 1 ? (
          <nav
            aria-label="作品分页"
            className="mt-6 flex items-center justify-between border-t border-border pt-5"
          >
            {data.page > 1 ? (
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "min-h-11 rounded-sm",
                )}
                href={adminHref({
                  page: data.page - 1,
                  query: data.query,
                  status: data.status,
                })}
              >
                <ArrowLeft aria-hidden="true" />
                上一页
              </Link>
            ) : (
              <span />
            )}

            <span className="text-sm tabular-nums text-muted-foreground">
              {data.page} / {totalPages}
            </span>

            {data.page < totalPages ? (
              <Link
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "min-h-11 rounded-sm",
                )}
                href={adminHref({
                  page: data.page + 1,
                  query: data.query,
                  status: data.status,
                })}
              >
                下一页
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
