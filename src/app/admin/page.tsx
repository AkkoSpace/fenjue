import {
  Archive,
  ArrowRight,
  BookOpenText,
  CircleAlert,
  Clock,
  Copy,
  Database,
  Eye,
  FolderTree,
  Heart,
  Images,
  ImageUp,
  MessageSquareText,
  Sparkles,
  Trash2,
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

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = units[0];

  for (let index = 1; index < units.length && value >= 1024; index += 1) {
    value /= 1024;
    unit = units[index];
  }

  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} ${unit}`;
}

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
      detail: "用户对作品表达感受的回应总数",
      icon: Sparkles,
      label: "作品回应",
      value: data.engagement.reactions,
    },
  ];
  const analyticsStorageStats = [
    {
      detail: data.analyticsStorage.oldestHotEventDate
        ? `最早在线明细：${dateFormatter.format(
            new Date(`${data.analyticsStorage.oldestHotEventDate}T00:00:00Z`),
          )}`
        : "当前没有浏览或复制明细",
      icon: Database,
      label: "在线明细",
      value: data.analyticsStorage.retainedEvents.toLocaleString("zh-CN"),
    },
    {
      detail: `${data.analyticsStorage.archivedFiles.toLocaleString("zh-CN")} 个压缩归档文件`,
      icon: Archive,
      label: "历史归档",
      value: data.analyticsStorage.archivedEvents.toLocaleString("zh-CN"),
    },
    {
      detail: data.analyticsStorage.lastArchivedAt
        ? `最近归档：${dateFormatter.format(
            new Date(data.analyticsStorage.lastArchivedAt),
          )}`
        : "尚未产生超过保留期的数据",
      icon: Clock,
      label: "归档体积",
      value: formatBytes(data.analyticsStorage.archivedBytes),
    },
  ];
  const imageStorageStats = [
    {
      detail: "已登记且仍被作品引用",
      icon: Images,
      label: "在用图片",
      value: data.imageCleanup.registered,
    },
    {
      detail: data.imageCleanup.oldestPendingAt
        ? `最早登记：${dateFormatter.format(
            new Date(data.imageCleanup.oldestPendingAt),
          )}`
        : "没有等待清理的对象",
      icon: Trash2,
      label: "等待清理",
      value: data.imageCleanup.pending,
    },
    {
      detail: data.imageCleanup.failed
        ? "任务会在 6 小时后自动重试"
        : "最近没有清理失败",
      icon: CircleAlert,
      label: "清理失败",
      value: data.imageCleanup.failed,
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

      <section aria-labelledby="storage-heading" className="mt-9">
        <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.16em] text-primary uppercase">
              Analytics storage · 统计存储
            </p>
            <h2 className="mt-1 font-serif text-2xl" id="storage-heading">
              明细保留与归档
            </h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            最近 {data.analyticsStorage.retentionDays} 天明细在线查询，按日汇总永久保留；
            更早的匿名明细压缩到私有 R2。
          </p>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-3">
          {analyticsStorageStats.map((stat) => {
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
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {stat.detail}
                </p>
              </div>
            );
          })}
        </div>
        {!data.analyticsStorage.configured ? (
          <p className="border-x border-b border-border px-5 py-3 text-xs leading-5 text-amber-800">
            {data.analyticsStorage.usesPublicImageBucket
              ? "统计归档不能使用公开图片桶，请配置独立的私有 R2 存储桶。"
              : "归档任务尚未完成服务端配置；明细会继续安全保留在 Supabase，不会被删除。"}
          </p>
        ) : data.analyticsStorage.pendingBatches > 0 ? (
          <p className="border-x border-b border-border px-5 py-3 text-xs leading-5 text-muted-foreground">
            有 {data.analyticsStorage.pendingBatches} 个归档批次等待自动重试。
          </p>
        ) : null}
      </section>

      <section aria-labelledby="image-storage-heading" className="mt-9">
        <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs tracking-[0.16em] text-primary uppercase">
              Image storage · 图片存储
            </p>
            <h2 className="mt-1 font-serif text-2xl" id="image-storage-heading">
              上传登记与自动清理
            </h2>
          </div>
          <p className="max-w-xl text-xs leading-5 text-muted-foreground">
            未完成投稿的图片保留 24 小时；作品移除的图片立即清理，失败后由每日任务重试。
          </p>
        </div>
        <div className="grid gap-px bg-border sm:grid-cols-3">
          {imageStorageStats.map((stat) => {
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
        {!data.imageCleanup.configured ? (
          <p className="border-x border-b border-border px-5 py-3 text-xs leading-5 text-amber-800">
            自动清理尚缺少服务端配置：{data.imageCleanup.missing.join("、")}。对象登记会继续保留，不会静默丢失清理任务。
          </p>
        ) : data.imageCleanup.failed ? (
          <p className="border-x border-b border-border px-5 py-3 text-xs leading-5 text-amber-800">
            有 {data.imageCleanup.failed} 个对象上次清理失败，系统将在下一轮自动重试。
          </p>
        ) : null}
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
