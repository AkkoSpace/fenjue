import {
  ArrowRight,
  BookOpenText,
  Copy,
  Eye,
  Flame,
  FolderTree,
  Heart,
  Images,
  ImageUp,
  MessageSquareText,
  Users,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { PromptReviewBadge } from "@/components/prompt-review-badge";
import { buttonVariants } from "@/components/ui/button";
import { getAdminOverview } from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  description: "查看焚诀内容、用户与分类的管理概况。",
  title: { absolute: "管理总览｜焚诀" },
};

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

function OverviewFallback() {
  return (
    <main>
      <div className="h-24 animate-pulse bg-muted/50" />
      <div className="mt-8 grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="h-28 animate-pulse bg-background" key={index} />
        ))}
      </div>
    </main>
  );
}

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<OverviewFallback />}>
      <OverviewContent />
    </Suspense>
  );
}

async function OverviewContent() {
  const data = await getAdminOverview();
  const stats = [
    {
      detail: `${data.content.counts.pending} 条等待审核`,
      icon: Images,
      label: "全部内容",
      value: data.content.counts.all,
    },
    {
      detail: "已注册账户",
      icon: Users,
      label: "用户",
      value: data.counts.users,
    },
    {
      detail: "编辑主题目录",
      icon: BookOpenText,
      label: "专栏",
      value: data.counts.collections,
    },
    {
      detail: "等待管理员判断",
      icon: MessageSquareText,
      label: "待审评价",
      value: data.counts.pendingComments,
    },
    {
      detail: "主分类",
      icon: FolderTree,
      label: "分类",
      value: data.counts.categories,
    },
    {
      detail: "受控内容标签",
      icon: FolderTree,
      label: "标签",
      value: data.counts.tags,
    },
  ];
  const engagementStats = [
    {
      detail: "同一访客每天每条作品去重一次",
      icon: Eye,
      label: "作品浏览",
      value: data.engagement.views,
    },
    {
      detail: "成功复制提示词的去重次数",
      icon: Copy,
      label: "提示词复制",
      value: data.engagement.copies,
    },
    {
      detail: "登录用户表达的喜欢",
      icon: Heart,
      label: "喜欢",
      value: data.engagement.likes,
    },
    {
      detail: "天地玄黄四阶反馈总数",
      icon: Flame,
      label: "品阶反馈",
      value: data.engagement.reactions,
    },
  ];

  return (
    <main>
      <AdminPageHeader
        action={
          <Link
            className={cn(
              buttonVariants({ size: "lg" }),
              "min-h-11 rounded-sm",
            )}
            href="/submit"
          >
            <ImageUp aria-hidden="true" />
            上传作品
          </Link>
        }
        description={`${data.content.profile.display_name || "管理员"}，这里集中展示全站内容、用户与分类状态。`}
        eyebrow="Administration · 总览"
        title="管理总览"
      />

      <section aria-label="关键数据" className="mt-8 grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div className="bg-background p-5" key={stat.label}>
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <Icon aria-hidden="true" className="size-4 text-primary" />
              </div>
              <p className="mt-5 text-3xl font-medium tabular-nums text-foreground">
                {stat.value}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">{stat.detail}</p>
            </div>
          );
        })}
      </section>

      <section aria-labelledby="engagement-heading" className="mt-9">
        <div className="border-b border-border pb-3">
          <p className="text-xs tracking-[0.16em] text-primary uppercase">
            Engagement · 互动
          </p>
          <h2 className="mt-1 font-serif text-2xl" id="engagement-heading">
            作品互动概况
          </h2>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
          {engagementStats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div className="bg-background p-5" key={stat.label}>
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <Icon aria-hidden="true" className="size-4 text-primary" />
                </div>
                <p className="mt-5 text-3xl font-medium tabular-nums text-foreground">
                  {stat.value.toLocaleString("zh-CN")}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {stat.detail}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid items-start gap-10 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section aria-labelledby="recent-heading">
          <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
            <div>
              <p className="text-xs tracking-[0.16em] text-primary uppercase">Recent</p>
              <h2 className="mt-1 font-serif text-2xl" id="recent-heading">
                最近内容
              </h2>
            </div>
            <Link
              className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-primary"
              href="/admin/content"
            >
              查看全部
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>

          {data.recent.length ? (
            <div className="divide-y divide-border">
              {data.recent.map((prompt) => (
                <Link
                  className="group flex min-h-16 items-center justify-between gap-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  href={`/admin/content/${prompt.id}/edit` as Route}
                  key={prompt.id}
                >
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium group-hover:text-primary">
                      {prompt.title}
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {prompt.authorName} · {dateFormatter.format(new Date(prompt.createdAt))}
                    </p>
                  </div>
                  <PromptReviewBadge
                    className="shrink-0"
                    status={prompt.reviewStatus}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="py-10 text-sm text-muted-foreground">还没有内容。</p>
          )}
        </section>

        <section aria-labelledby="quick-heading" className="border-y border-border py-5">
          <p className="text-xs tracking-[0.16em] text-primary uppercase">Quick Access</p>
          <h2 className="mt-1 font-serif text-2xl" id="quick-heading">
            常用入口
          </h2>
          <div className="mt-5 divide-y divide-border">
            {[
              ["审核内容", "检查投稿、编辑内容并给出审核结论", "/admin/content?status=pending"],
              ["审核评价", "处理用户提交的实测心得", "/admin/comments?status=pending"],
              ["编纂专栏", "创建主题目录并控制公开状态", "/admin/collections"],
              ["查看用户", "确认邮箱状态与调整管理员权限", "/admin/users"],
              ["维护分类", "管理主分类、风格、形式与主题标签", "/admin/taxonomy"],
            ].map(([label, description, href]) => (
              <Link
                className="group flex min-h-16 items-center justify-between gap-4 py-4"
                href={href as Route}
                key={href}
              >
                <span>
                  <span className="block text-sm font-medium group-hover:text-primary">
                    {label}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {description}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
