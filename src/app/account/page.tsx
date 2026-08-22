import { ArrowRight, LogOut, MessageSquareText, ShieldCheck } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthShell, AuthShellFallback } from "@/components/auth/auth-shell";
import { PromptReviewBadge } from "@/components/prompt-review-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { type AuthPageProps, getAuthPageState } from "@/lib/auth/page";
import type { PromptReviewStatus } from "@/lib/content/review";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "账户",
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

export default function AccountPage(props: AuthPageProps) {
  return (
    <Suspense fallback={<AuthShellFallback />}>
      <AccountContent {...props} />
    </Suspense>
  );
}

async function AccountContent({ searchParams }: AuthPageProps) {
  if (!hasSupabasePublicConfig()) {
    const params = new URLSearchParams({
      error: "认证服务尚未完成配置，请稍后再试。",
    });
    redirect(`/login?${params.toString()}` as Route);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const [profileResult, submissionResult, commentResult, { message }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,is_super_admin,role")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("prompts")
      .select("id,slug,title,review_status,review_note,published,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("prompt_comments")
      .select(
        "id,body,review_status,review_note,created_at,prompt:prompts!inner(slug,title,published,review_status)",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    getAuthPageState(searchParams),
  ]);
  const profile = profileResult.data;
  if (submissionResult.error) {
    console.warn("Unable to load account submissions", submissionResult.error.code);
  }
  if (commentResult.error) {
    console.warn("Unable to load account comments", commentResult.error.code);
  }
  const submissions = (submissionResult.data ?? []) as {
    created_at: string;
    id: string;
    published: boolean;
    review_note: string | null;
    review_status: PromptReviewStatus;
    slug: string;
    title: string;
  }[];
  const comments = (commentResult.data ?? []).flatMap((value) => {
    const row = value as unknown as {
      body: string;
      created_at: string;
      id: string;
      prompt: {
        published: boolean;
        review_status: PromptReviewStatus;
        slug: string;
        title: string;
      } | {
        published: boolean;
        review_status: PromptReviewStatus;
        slug: string;
        title: string;
      }[];
      review_note: string | null;
      review_status: PromptReviewStatus;
    };
    const prompt = Array.isArray(row.prompt) ? row.prompt[0] : row.prompt;
    return prompt ? [{ ...row, prompt }] : [];
  });
  const isAdmin = profile?.role === "admin";
  const identity = profile?.is_super_admin
    ? "超级管理员"
    : isAdmin
      ? "管理员"
      : "用户";

  return (
    <AuthShell
      description="你的账户不会影响公开浏览；投稿、喜欢、品阶与实测心得归属于同一身份。"
      eyebrow="Account · 账户"
      message={message}
      title={profile?.display_name || "我的账户"}
    >
      <dl className="divide-y divide-border/80 border-y border-border/80 text-sm">
        <div className="grid gap-1 py-4 sm:grid-cols-[6rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">邮箱</dt>
          <dd className="break-all text-foreground">{user.email}</dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[6rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">邮箱状态</dt>
          <dd className="text-foreground">
            {user.email_confirmed_at ? "已验证" : "等待验证"}
          </dd>
        </div>
        <div className="grid gap-1 py-4 sm:grid-cols-[6rem_1fr] sm:gap-4">
          <dt className="text-muted-foreground">身份</dt>
          <dd className="text-foreground">{identity}</dd>
        </div>
      </dl>

      <section aria-labelledby="submissions-heading" className="mt-7">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-primary uppercase">
              Submissions
            </p>
            <h2 className="mt-1 font-serif text-xl" id="submissions-heading">
              我的投稿
            </h2>
          </div>
          <Link
            className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-primary"
            href="/submit"
          >
            继续提交
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        {submissions.length ? (
          <div className="divide-y divide-border">
            {submissions.map((submission) => {
              const content = (
                <>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium text-foreground">
                      {submission.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dateFormatter.format(new Date(submission.created_at))}
                    </p>
                  </div>
                  <PromptReviewBadge
                    className="shrink-0"
                    status={submission.review_status}
                  />
                </>
              );

              return (
                <article className="py-4" key={submission.id}>
                  {submission.review_status === "approved" &&
                  submission.published ? (
                    <Link
                      className="group flex min-h-11 items-center justify-between gap-4"
                      href={`/prompts/${submission.slug}` as Route}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex min-h-11 items-center justify-between gap-4">
                      {content}
                    </div>
                  )}
                  {submission.review_status === "rejected" &&
                  submission.review_note ? (
                    <p className="mt-2 border-l-2 border-destructive/40 pl-3 text-xs leading-5 text-muted-foreground">
                      {submission.review_note}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="py-5 text-sm leading-6 text-muted-foreground">
            还没有投稿。提交后可以在这里查看审核状态。
          </p>
        )}
      </section>

      <section aria-labelledby="comments-heading" className="mt-7">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-primary uppercase">Field Notes</p>
            <h2 className="mt-1 font-serif text-xl" id="comments-heading">我的实测心得</h2>
          </div>
          <MessageSquareText aria-hidden="true" className="size-4 text-primary" />
        </div>
        {comments.length ? (
          <div className="divide-y divide-border">
            {comments.map((comment) => {
              const publicPrompt =
                comment.prompt.published &&
                comment.prompt.review_status === "approved";
              return (
                <article className="py-4" key={comment.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      {publicPrompt ? (
                        <Link className="text-sm font-medium text-foreground hover:text-primary" href={`/prompts/${comment.prompt.slug}#comments` as Route}>
                          {comment.prompt.title}
                        </Link>
                      ) : (
                        <h3 className="text-sm font-medium text-foreground">{comment.prompt.title}</h3>
                      )}
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{comment.body}</p>
                    </div>
                    <PromptReviewBadge className="shrink-0" status={comment.review_status} />
                  </div>
                  {comment.review_status === "rejected" && comment.review_note ? (
                    <p className="mt-2 border-l-2 border-destructive/40 pl-3 text-xs leading-5 text-muted-foreground">
                      {comment.review_note}
                    </p>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="py-5 text-sm leading-6 text-muted-foreground">
            还没有提交实测心得。打开任意公开作品即可记录实际生成体验。
          </p>
        )}
      </section>

      {isAdmin ? (
        <Link
          className={cn(
            buttonVariants({ size: "lg" }),
            "mt-6 min-h-11 w-full rounded-sm",
          )}
          href={"/admin" as Route}
        >
          <ShieldCheck aria-hidden="true" />
          进入内容管理
        </Link>
      ) : null}

      <form action={signOut} className={isAdmin ? "mt-3" : "mt-6"}>
        <Button
          className="min-h-11 w-full rounded-sm"
          size="lg"
          type="submit"
          variant="outline"
        >
          <LogOut data-icon="inline-start" aria-hidden="true" />
          退出登录
        </Button>
      </form>
    </AuthShell>
  );
}
