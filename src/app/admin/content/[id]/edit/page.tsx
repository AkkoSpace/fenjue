import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  History,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { AdminNotice, firstMessage } from "@/components/admin/admin-notice";
import { AdminPromptEditor } from "@/components/admin/admin-prompt-editor";
import { PromptReviewBadge } from "@/components/prompt-review-badge";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewPrompt } from "@/lib/admin/actions";
import { getAdminAiTools } from "@/lib/admin/ai-tool-queries";
import { getAdminSourcePlatforms } from "@/lib/admin/source-platform-queries";
import { getAdminCollections } from "@/lib/admin/editorial-queries";
import {
  type AdminPromptSearchParams,
  type AdminReviewNavigation,
  getAdminPrompt,
  getAdminReviewNavigation,
} from "@/lib/admin/queries";
import { getContentTaxonomy } from "@/lib/content/queries";
import { PROMPT_REVIEW_STATUS_META } from "@/lib/content/review";
import { cn } from "@/lib/utils";

interface EditPromptPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<
    AdminPromptSearchParams & {
      error?: string | string[];
      success?: string | string[];
      warning?: string | string[];
    }
  >;
}

export const metadata: Metadata = {
  description: "逐项编辑作品内容与图片。",
  title: { absolute: "编辑作品｜焚诀" },
};

const reviewDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function EditFallback() {
  return <main><div className="h-28 animate-pulse bg-muted/40" /><div className="mt-8 h-96 animate-pulse bg-muted/30" /></main>;
}

function reviewQueueParams(navigation: AdminReviewNavigation) {
  const params = new URLSearchParams();
  if (navigation.category) params.set("category", navigation.category);
  if (navigation.page > 1) params.set("page", String(navigation.page));
  if (navigation.quality !== "all") params.set("quality", navigation.quality);
  if (navigation.query) params.set("q", navigation.query);
  params.set("status", navigation.status);
  return params;
}

function contentListHref(navigation: AdminReviewNavigation) {
  const params = reviewQueueParams(navigation).toString();
  return `/admin/content?${params}` as Route;
}

function promptReviewHref(id: string, navigation: AdminReviewNavigation) {
  const params = reviewQueueParams(navigation).toString();
  return `/admin/content/${id}/edit?${params}` as Route;
}

export default function EditPromptPage(props: EditPromptPageProps) {
  return <Suspense fallback={<EditFallback />}><EditPromptContent {...props} /></Suspense>;
}

async function EditPromptContent({ params, searchParams }: EditPromptPageProps) {
  const { id } = await params;
  const [prompt, taxonomy, collections, modelDirectory, sourcePlatforms, rawMessages] = await Promise.all([
    getAdminPrompt(id),
    getContentTaxonomy(),
    getAdminCollections(),
    getAdminAiTools(),
    getAdminSourcePlatforms(),
    searchParams,
  ]);
  if (!prompt) notFound();
  const navigation = await getAdminReviewNavigation({
    createdAt: prompt.createdAt,
    currentId: prompt.id,
    currentStatus: prompt.reviewStatus,
    raw: rawMessages,
  });
  const message = firstMessage(rawMessages.error)
    ? { kind: "error" as const, text: firstMessage(rawMessages.error)! }
    : firstMessage(rawMessages.warning)
      ? { kind: "warning" as const, text: firstMessage(rawMessages.warning)! }
      : firstMessage(rawMessages.success)
        ? { kind: "success" as const, text: firstMessage(rawMessages.success)! }
        : undefined;
  const returnTo = promptReviewHref(prompt.id, navigation);
  const nextReturnTo = prompt.reviewStatus === "pending" && navigation.next
    ? promptReviewHref(navigation.next.id, navigation)
    : undefined;

  return (
    <main>
      <header className="border-b border-border pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
            href={contentListHref(navigation)}
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            返回审核队列
          </Link>
          <nav aria-label="审核队列导航" className="flex items-center gap-1 border border-border bg-background">
            {navigation.previous ? (
              <Link
                aria-label={`上一条：${navigation.previous.title}`}
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "min-h-11 rounded-none border-r border-border px-3")}
                href={promptReviewHref(navigation.previous.id, navigation)}
                title={`上一条：${navigation.previous.title}`}
              >
                <ArrowLeft aria-hidden="true" />
                <span className="hidden sm:inline">上一条</span>
              </Link>
            ) : null}
            {navigation.next ? (
              <Link
                aria-label={`下一条：${navigation.next.title}`}
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "min-h-11 rounded-none px-3")}
                href={promptReviewHref(navigation.next.id, navigation)}
                title={`下一条：${navigation.next.title}`}
              >
                <span className="hidden sm:inline">下一条</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : null}
          </nav>
        </div>

        <div className="mt-5 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="min-w-0 max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-medium tracking-[0.18em] text-primary uppercase">
                Review Desk · 审阅台
              </p>
            </div>
            <h1 className="mt-2 text-balance font-serif text-2xl leading-tight text-foreground sm:text-3xl">
              {prompt.title}
            </h1>
            <p className="mt-2 text-xs leading-5 text-muted-foreground sm:text-sm">
              {prompt.slug} · {prompt.images.length} 张图片 · {prompt.authorName}
            </p>
          </div>
          {prompt.reviewStatus === "approved" && prompt.published ? (
            <Link
              className={cn(buttonVariants({ variant: "outline" }), "min-h-11 shrink-0 rounded-sm")}
              href={`/prompts/${prompt.slug}` as Route}
              target="_blank"
            >
              <ExternalLink aria-hidden="true" />
              查看公开页面
            </Link>
          ) : null}
        </div>
      </header>
      {message ? <AdminNotice kind={message.kind} text={message.text} /> : null}

      <section
        aria-label="审核结论"
        className="mt-5 border border-border bg-background shadow-[0_12px_32px_-28px_oklch(0.22_0.02_55/0.55)] xl:sticky xl:top-24 xl:z-20"
      >
        <form
          action={reviewPrompt}
          className="grid gap-3 p-3 lg:p-4 xl:grid-cols-[minmax(13rem,0.65fr)_minmax(16rem,1fr)_auto] xl:items-end"
        >
          <input name="id" type="hidden" value={prompt.id} />
          <input name="returnTo" type="hidden" value={returnTo} />
          {nextReturnTo ? (
            <input name="nextReturnTo" type="hidden" value={nextReturnTo} />
          ) : null}
          <div className="min-w-0 self-center">
            <div className="flex items-center gap-2">
              <span className="font-serif text-lg text-foreground">审核结论</span>
              <PromptReviewBadge status={prompt.reviewStatus} />
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
              {PROMPT_REVIEW_STATUS_META[prompt.reviewStatus].description}
              {prompt.reviewedAt
                ? ` ${reviewDateFormatter.format(new Date(prompt.reviewedAt))}`
                : " 尚无审核记录。"}
            </p>
            {prompt.reviewNote ? (
              <p className="mt-1 truncate text-xs text-destructive" title={prompt.reviewNote}>
                上次备注：
                {prompt.reviewNote}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="review-note">
              审核备注
            </label>
            <Textarea
              className="min-h-11 resize-none py-2.5"
              defaultValue={prompt.reviewNote ?? ""}
              id="review-note"
              maxLength={2000}
              name="note"
              placeholder="驳回时说明原因；通过可留空"
              rows={1}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
            <ActionButton
              className="min-h-11 flex-1 rounded-sm whitespace-nowrap xl:flex-none"
              disabled={prompt.reviewStatus === "approved"}
              name="decision"
              pendingLabel="处理中"
              type="submit"
              value="approved"
            >
              <CheckCircle2 aria-hidden="true" />
              {nextReturnTo ? "通过并下一条" : "通过并公开"}
            </ActionButton>
            <ActionButton
              className="min-h-11 flex-1 rounded-sm whitespace-nowrap xl:flex-none"
              name="decision"
              pendingLabel="处理中"
              type="submit"
              value="rejected"
              variant="outline"
            >
              <XCircle aria-hidden="true" />
              {nextReturnTo ? "驳回并下一条" : "驳回"}
            </ActionButton>
            {prompt.reviewStatus !== "pending" ? (
              <ActionButton
                aria-label="退回待审核"
                className="min-h-11 rounded-sm px-3"
                name="decision"
                pendingLabel="处理中"
                title="退回待审核"
                type="submit"
                value="pending"
                variant="ghost"
              >
                <RotateCcw aria-hidden="true" />
              </ActionButton>
            ) : null}
          </div>
        </form>
      </section>
      <AdminPromptEditor aiTools={modelDirectory.items} categories={taxonomy.categories} collections={collections} initial={prompt} key={`${prompt.title}:${prompt.images.map((image) => image.id).join(":")}`} sourcePlatforms={sourcePlatforms.items} tags={taxonomy.tags} />

      {prompt.reviewHistory.length ? (
        <details className="group mt-10 border-y border-border">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 text-sm font-medium text-foreground marker:content-none">
            <History aria-hidden="true" className="size-4 text-muted-foreground" />
            审核历史
            <span className="text-xs font-normal tabular-nums text-muted-foreground">
              {prompt.reviewHistory.length} 条
            </span>
            <span className="ml-auto text-xs text-muted-foreground group-open:hidden">展开</span>
            <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">收起</span>
          </summary>
          <ol className="divide-y divide-border border-t border-border">
            {prompt.reviewHistory.map((review) => (
              <li className="grid gap-2 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start sm:gap-4" key={review.id}>
                <PromptReviewBadge status={review.decision} />
                <div className="min-w-0 text-sm text-foreground">
                  <p>{review.reviewerName}</p>
                  {review.note ? (
                    <p className="mt-1 whitespace-pre-wrap leading-6 text-muted-foreground">{review.note}</p>
                  ) : (
                    <p className="mt-1 text-muted-foreground">未填写备注</p>
                  )}
                </div>
                <time className="text-xs text-muted-foreground" dateTime={review.reviewedAt}>
                  {reviewDateFormatter.format(new Date(review.reviewedAt))}
                </time>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </main>
  );
}
