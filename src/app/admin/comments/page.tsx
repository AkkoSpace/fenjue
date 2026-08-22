import { ArrowLeft, ArrowRight, CheckCircle2, MessageSquareText, XCircle } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { AdminNotice, firstMessage } from "@/components/admin/admin-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PromptReviewBadge } from "@/components/prompt-review-badge";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewPromptComment } from "@/lib/admin/comment-actions";
import {
  type AdminCommentStatus,
  getAdminPromptComments,
} from "@/lib/admin/comment-queries";
import { getAiToolOption } from "@/lib/content/ai-tools";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "评价审核｜焚诀" },
};

interface PageProps {
  searchParams: Promise<{
    error?: string | string[];
    page?: string | string[];
    status?: string | string[];
    success?: string | string[];
  }>;
}
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATUS_OPTIONS: { label: string; value: AdminCommentStatus }[] = [
  { label: "全部", value: "all" },
  { label: "待审核", value: "pending" },
  { label: "已通过", value: "approved" },
  { label: "已驳回", value: "rejected" },
];

function href(status: AdminCommentStatus, page = 1) {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/admin/comments${query ? `?${query}` : ""}` as Route;
}

function Fallback() {
  return <div className="h-96 animate-pulse bg-muted/30" />;
}

export default function AdminCommentsPage(props: PageProps) {
  return (
    <Suspense fallback={<Fallback />}>
      <CommentsContent {...props} />
    </Suspense>
  );
}

async function CommentsContent({ searchParams }: PageProps) {
  const raw = await searchParams;
  const data = await getAdminPromptComments(raw);
  const error = firstMessage(raw.error);
  const success = firstMessage(raw.success);
  const returnTo = href(data.status, data.page);

  return (
    <main>
      <AdminPageHeader
        description="所有用户心得默认待审核；只判断是否是具体、友善、与实际生成有关的反馈。"
        eyebrow="Field Notes · 评价"
        title="评价审核"
      />
      {error ? <AdminNotice kind="error" text={error} /> : null}
      {success ? <AdminNotice kind="success" text={success} /> : null}

      <nav aria-label="评价状态" className="mt-7 flex gap-1 overflow-x-auto border-y border-border py-2">
        {STATUS_OPTIONS.map((option) => (
          <Link
            aria-current={data.status === option.value ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center px-4 text-sm transition-colors",
              data.status === option.value
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            href={href(option.value)}
            key={option.value}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      <section aria-label="评价列表" className="mt-6 divide-y divide-border border-y border-border">
        {data.comments.length ? data.comments.map((comment) => (
          <article className="py-6" key={comment.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{comment.authorName}</span>
                  <PromptReviewBadge status={comment.reviewStatus} />
                  {comment.toolKey ? (
                    <span className="border border-border px-2 py-1 text-xs text-muted-foreground">
                      {getAiToolOption(comment.toolKey).label}
                    </span>
                  ) : null}
                </div>
                <Link
                  className="mt-2 inline-flex min-h-9 items-center text-sm text-muted-foreground underline underline-offset-4 hover:text-primary"
                  href={`/prompts/${comment.promptSlug}` as Route}
                  target="_blank"
                >
                  {comment.promptTitle}
                </Link>
              </div>
              <time className="text-xs text-muted-foreground" dateTime={comment.createdAt}>
                {dateFormatter.format(new Date(comment.createdAt))}
              </time>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90">
              {comment.body}
            </p>
            {comment.reviewNote ? (
              <p className="mt-3 border-l-2 border-destructive/40 pl-3 text-xs leading-5 text-muted-foreground">
                审核备注：{comment.reviewNote}
              </p>
            ) : null}

            <form action={reviewPromptComment} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
              <input name="id" type="hidden" value={comment.id} />
              <input name="slug" type="hidden" value={comment.promptSlug} />
              <input name="returnTo" type="hidden" value={returnTo} />
              <div>
                <label className="text-xs font-medium text-muted-foreground" htmlFor={`comment-note-${comment.id}`}>
                  审核备注（驳回时必填）
                </label>
                <Textarea defaultValue={comment.reviewNote ?? ""} id={`comment-note-${comment.id}`} maxLength={1000} name="note" rows={2} />
              </div>
              <ActionButton className="min-h-11 rounded-sm" name="decision" pendingLabel="处理中" type="submit" value="approved">
                <CheckCircle2 aria-hidden="true" />
                通过
              </ActionButton>
              <ActionButton className="min-h-11 rounded-sm" name="decision" pendingLabel="处理中" type="submit" value="rejected" variant="outline">
                <XCircle aria-hidden="true" />
                驳回
              </ActionButton>
            </form>
          </article>
        )) : (
          <div className="py-16 text-center">
            <MessageSquareText aria-hidden="true" className="mx-auto size-5 text-primary" />
            <p className="mt-3 font-serif text-lg">当前筛选下没有评价</p>
          </div>
        )}
      </section>

      {data.totalPages > 1 ? (
        <nav aria-label="评价分页" className="mt-6 flex items-center justify-between gap-4">
          {data.page > 1 ? (
            <Link className={cn(buttonVariants({ variant: "outline" }), "rounded-sm")} href={href(data.status, data.page - 1)}>
              <ArrowLeft aria-hidden="true" />上一页
            </Link>
          ) : <span />}
          <span className="text-sm tabular-nums text-muted-foreground">第 {data.page} / {data.totalPages} 页</span>
          {data.page < data.totalPages ? (
            <Link className={cn(buttonVariants({ variant: "outline" }), "rounded-sm")} href={href(data.status, data.page + 1)}>
              下一页<ArrowRight aria-hidden="true" />
            </Link>
          ) : <span />}
        </nav>
      ) : null}
    </main>
  );
}
