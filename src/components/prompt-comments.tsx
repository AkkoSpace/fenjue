"use client";

import { MessageSquareText, Send, Trash2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { AiTool } from "@/lib/content/ai-tools";
import {
  deleteOwnPromptComment,
  INITIAL_COMMENT_ACTION_STATE,
  submitPromptComment,
} from "@/lib/content/comment-actions";
import {
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
  type PromptComment,
} from "@/lib/content/editorial";
import { PROMPT_REVIEW_STATUS_META } from "@/lib/content/review";
import { cn } from "@/lib/utils";

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
  timeZone: "Asia/Shanghai",
});

function mergeComments(published: PromptComment[], own: PromptComment[]) {
  const comments = new Map(published.map((comment) => [comment.id, comment]));
  own.forEach((comment) => comments.set(comment.id, comment));
  return [...comments.values()].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export function PromptComments({
  aiTools,
  isAuthenticated,
  ownComments,
  publishedComments,
  publishedTotal,
  slug,
}: {
  aiTools: AiTool[];
  isAuthenticated: boolean;
  ownComments: PromptComment[];
  publishedComments: PromptComment[];
  publishedTotal: number;
  slug: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(
    submitPromptComment,
    INITIAL_COMMENT_ACTION_STATE,
  );
  const [deleteMessage, setDeleteMessage] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const comments = useMemo(
    () => mergeComments(publishedComments, ownComments),
    [ownComments, publishedComments],
  );
  const loginHref = `/login?next=${encodeURIComponent(
    `/prompts/${slug}#comments`,
  )}` as Route;

  useEffect(() => {
    if (state.status !== "success") return;
    formRef.current?.reset();
    router.refresh();
  }, [router, state.status]);

  function removeComment(commentId: string) {
    setDeleteMessage("");
    setDeletingId(commentId);
    startTransition(async () => {
      const result = await deleteOwnPromptComment(commentId);
      setDeleteMessage(result.message);
      setDeletingId(null);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <section className="mt-12 border-t border-border pt-8" id="comments">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">
            Field Notes · 实测
          </p>
          <h2 className="mt-1 font-serif text-2xl text-foreground">实测心得</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            说说你在哪个平台尝试、哪里有效、哪里需要调整。评价记录实际使用，和快捷表情回应各有用途。
          </p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {publishedTotal} 条公开心得
        </span>
      </div>

      {isAuthenticated ? (
        <form action={formAction} className="border-b border-border py-6" ref={formRef}>
          <input name="slug" type="hidden" value={slug} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_12rem]">
            <div>
              <label className="text-sm font-medium" htmlFor="comment-body">
                你的实测心得
              </label>
              <Textarea
                aria-describedby="comment-help"
                className="mt-2"
                id="comment-body"
                maxLength={MAX_COMMENT_LENGTH}
                minLength={MIN_COMMENT_LENGTH}
                name="body"
                placeholder="例如：在豆包使用时人物质感很好，但中文小字需要重新生成两次……"
                required
                rows={4}
              />
              <p className="mt-2 text-xs leading-5 text-muted-foreground" id="comment-help">
                {MIN_COMMENT_LENGTH}-{MAX_COMMENT_LENGTH} 字；只支持纯文字，提交后先进入审核。
              </p>
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="comment-tool">
                使用平台
              </label>
              <select
                className="mt-2 min-h-11 w-full rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                defaultValue=""
                id="comment-tool"
                name="toolKey"
              >
                <option value="">未说明</option>
                {aiTools.map((tool) => (
                  <option key={tool.key} value={tool.key}>
                    {tool.name}
                  </option>
                ))}
              </select>
              <Button
                className="mt-4 min-h-11 w-full rounded-sm"
                disabled={isPending}
                type="submit"
              >
                <Send aria-hidden="true" />
                {isPending ? "提交中" : "提交心得"}
              </Button>
            </div>
          </div>
          <p
            aria-live="polite"
            className={cn(
              "mt-3 min-h-5 text-sm",
              state.status === "error" ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {state.message}
          </p>
        </form>
      ) : (
        <div className="border-b border-border py-6 text-sm text-muted-foreground">
          <Link
            className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
            href={loginHref}
          >
            登录后提交实测心得
          </Link>
          <span>；浏览公开评价仍然不需要登录。</span>
        </div>
      )}

      {deleteMessage ? (
        <p aria-live="polite" className="border-b border-border py-3 text-sm text-muted-foreground">
          {deleteMessage}
        </p>
      ) : null}

      {comments.length ? (
        <div className="divide-y divide-border">
          {comments.map((comment) => {
            const status = PROMPT_REVIEW_STATUS_META[comment.reviewStatus];
            return (
              <article className="py-6" key={comment.id}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <h3 className="font-medium text-foreground">
                      {comment.authorName}
                      {comment.isOwn ? " · 我" : ""}
                    </h3>
                    <time className="text-xs text-muted-foreground" dateTime={comment.createdAt}>
                      {dateFormatter.format(new Date(comment.createdAt))}
                    </time>
                    {comment.tool ? (
                      <span className="border border-border px-2 py-1 text-xs text-muted-foreground">
                        {comment.tool.name}
                      </span>
                    ) : null}
                    {comment.reviewStatus !== "approved" ? (
                      <span className="border border-primary/25 bg-primary/5 px-2 py-1 text-xs text-primary">
                        {status.label} · 仅自己可见
                      </span>
                    ) : null}
                  </div>
                  {comment.isOwn ? (
                    <Button
                      aria-label="删除这条心得"
                      className="min-h-11 rounded-sm text-muted-foreground hover:text-destructive"
                      disabled={deletingId === comment.id}
                      onClick={() => removeComment(comment.id)}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" />
                      {deletingId === comment.id ? "删除中" : "删除"}
                    </Button>
                  ) : null}
                </div>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-foreground/90 sm:text-base">
                  {comment.body}
                </p>
                {comment.reviewStatus === "rejected" && comment.reviewNote ? (
                  <p className="mt-3 border-l-2 border-destructive/40 pl-3 text-xs leading-5 text-muted-foreground">
                    驳回原因：{comment.reviewNote}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="py-10 text-center">
          <MessageSquareText aria-hidden="true" className="mx-auto size-5 text-primary" />
          <p className="mt-3 font-serif text-lg text-foreground">还没有公开心得</p>
          <p className="mt-1 text-sm text-muted-foreground">
            如果你实际尝试过，可以成为第一位记录者。
          </p>
        </div>
      )}
    </section>
  );
}
