import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  XCircle,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { AdminNotice, firstMessage } from "@/components/admin/admin-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPromptEditor } from "@/components/admin/admin-prompt-editor";
import { PromptReviewBadge } from "@/components/prompt-review-badge";
import { buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { reviewPrompt } from "@/lib/admin/actions";
import { getAdminPrompt } from "@/lib/admin/queries";
import { getContentTaxonomy } from "@/lib/content/queries";
import { PROMPT_REVIEW_STATUS_META } from "@/lib/content/review";
import { cn } from "@/lib/utils";

interface EditPromptPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string | string[];
    success?: string | string[];
    warning?: string | string[];
  }>;
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

export default function EditPromptPage(props: EditPromptPageProps) {
  return <Suspense fallback={<EditFallback />}><EditPromptContent {...props} /></Suspense>;
}

async function EditPromptContent({ params, searchParams }: EditPromptPageProps) {
  const { id } = await params;
  const [prompt, taxonomy, rawMessages] = await Promise.all([
    getAdminPrompt(id),
    getContentTaxonomy(),
    searchParams,
  ]);
  if (!prompt) notFound();
  const message = firstMessage(rawMessages.error)
    ? { kind: "error" as const, text: firstMessage(rawMessages.error)! }
    : firstMessage(rawMessages.warning)
      ? { kind: "warning" as const, text: firstMessage(rawMessages.warning)! }
      : firstMessage(rawMessages.success)
        ? { kind: "success" as const, text: firstMessage(rawMessages.success)! }
        : undefined;
  const returnTo = `/admin/content/${prompt.id}/edit`;

  return (
    <main>
      <Link className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary" href="/admin/content"><ArrowLeft aria-hidden="true" className="size-4" />返回内容管理</Link>
      <AdminPageHeader
        action={prompt.reviewStatus === "approved" && prompt.published ? (
          <Link className={cn(buttonVariants({ variant: "outline" }), "min-h-11 rounded-sm")} href={`/prompts/${prompt.slug}` as Route} target="_blank"><ExternalLink aria-hidden="true" />查看公开页面</Link>
        ) : undefined}
        description={`正在处理 ${prompt.slug}。先保存内容修改，再单独给出审核结论。`}
        eyebrow="Content Review · 单条审核"
        title={prompt.title}
      />
      {message ? <AdminNotice kind={message.kind} text={message.text} /> : null}

      <section
        aria-labelledby="review-heading"
        className="mt-8 border-y border-border py-5"
      >
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(18rem,0.38fr)] lg:gap-12">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-serif text-2xl" id="review-heading">
                审核结论
              </h2>
              <PromptReviewBadge status={prompt.reviewStatus} />
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {PROMPT_REVIEW_STATUS_META[prompt.reviewStatus].description}
              {prompt.reviewedAt
                ? ` 最近一次审核于 ${reviewDateFormatter.format(new Date(prompt.reviewedAt))}。`
                : " 当前还没有审核记录。"}
            </p>
            {prompt.reviewNote ? (
              <div className="mt-4 border-l-2 border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm leading-6 text-foreground">
                <span className="font-medium">当前驳回原因：</span>
                {prompt.reviewNote}
              </div>
            ) : null}
          </div>

          <form action={reviewPrompt} className="space-y-3">
            <input name="id" type="hidden" value={prompt.id} />
            <input name="returnTo" type="hidden" value={returnTo} />
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="review-note">
                审核备注
              </label>
              <Textarea
                defaultValue={prompt.reviewNote ?? ""}
                id="review-note"
                maxLength={2000}
                name="note"
                placeholder="驳回时必须说明原因；通过时可留空"
                rows={4}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton
                className="min-h-11 rounded-sm"
                disabled={prompt.reviewStatus === "approved"}
                name="decision"
                pendingLabel="处理中"
                type="submit"
                value="approved"
              >
                <CheckCircle2 aria-hidden="true" />
                通过并公开
              </ActionButton>
              <ActionButton
                className="min-h-11 rounded-sm"
                name="decision"
                pendingLabel="处理中"
                type="submit"
                value="rejected"
                variant="outline"
              >
                <XCircle aria-hidden="true" />
                驳回
              </ActionButton>
            </div>
            {prompt.reviewStatus !== "pending" ? (
              <ActionButton
                className="min-h-11 w-full rounded-sm"
                name="decision"
                pendingLabel="处理中"
                type="submit"
                value="pending"
                variant="ghost"
              >
                <RotateCcw aria-hidden="true" />
                退回待审核
              </ActionButton>
            ) : null}
          </form>
        </div>
      </section>
      <AdminPromptEditor categories={taxonomy.categories} initial={prompt} key={`${prompt.title}:${prompt.images.map((image) => image.id).join(":")}`} tags={taxonomy.tags} />
    </main>
  );
}
