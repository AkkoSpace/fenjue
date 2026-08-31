import { Bot, ExternalLink, PencilLine, Plus, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { AiToolMark } from "@/components/ai-tool-mark";
import { ActionButton } from "@/components/admin/action-button";
import { AdminNotice, firstMessage } from "@/components/admin/admin-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Input } from "@/components/ui/input";
import { deleteAiTool, saveAiTool } from "@/lib/admin/ai-tool-actions";
import {
  type AdminAiTool,
  getAdminAiTools,
} from "@/lib/admin/ai-tool-queries";

export const metadata: Metadata = {
  description: "维护投稿、作品与实测心得可选择的生成模型。",
  title: { absolute: "模型管理｜焚诀" },
};

interface ModelsPageProps {
  searchParams: Promise<{
    error?: string | string[];
    success?: string | string[];
  }>;
}

const fieldClass = "space-y-2";
const labelClass = "block text-xs font-medium text-muted-foreground";

function ModelsFallback() {
  return (
    <main>
      <div className="h-24 animate-pulse bg-muted/40" />
      <div className="mt-8 h-96 animate-pulse bg-muted/30" />
    </main>
  );
}

function ModelRow({ item }: { item: AdminAiTool }) {
  const usageCount = item.promptUsageCount + item.commentUsageCount;

  return (
    <details className="group border-b border-border">
      <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="flex min-w-0 items-center gap-3">
          <AiToolMark className="size-10 bg-background" tool={item} />
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
              {item.name}
              <span
                className={
                  item.active
                    ? "text-xs text-emerald-700"
                    : "text-xs text-muted-foreground"
                }
              >
                {item.active ? "启用" : "停用"}
              </span>
            </span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">
              {item.key} · 排序 {item.sortOrder} · {item.promptUsageCount} 条作品 · {item.commentUsageCount} 条心得
            </span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground group-open:text-primary">
          <PencilLine aria-hidden="true" className="size-4" />
          编辑
        </span>
      </summary>

      <div className="border-t border-dashed border-border bg-muted/20 p-4 sm:p-5">
        <form action={saveAiTool} className="grid gap-4 lg:grid-cols-2">
          <input name="intent" type="hidden" value="update" />
          <input name="key" type="hidden" value={item.key} />
          <div className={fieldClass}>
            <label className={labelClass} htmlFor={`model-name-${item.key}`}>
              显示名称
            </label>
            <Input
              defaultValue={item.name}
              id={`model-name-${item.key}`}
              maxLength={48}
              name="name"
              required
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor={`model-order-${item.key}`}>
              排序
            </label>
            <Input
              defaultValue={item.sortOrder}
              id={`model-order-${item.key}`}
              max={32767}
              min={1}
              name="sortOrder"
              required
              type="number"
            />
          </div>
          <div className={`${fieldClass} lg:col-span-2`}>
            <label
              className={labelClass}
              htmlFor={`model-description-${item.key}`}
            >
              简短说明
            </label>
            <Input
              defaultValue={item.description}
              id={`model-description-${item.key}`}
              maxLength={160}
              name="description"
              placeholder="例如：Google 的图像生成与编辑模型"
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor={`model-logo-${item.key}`}>
              Logo 地址
            </label>
            <Input
              defaultValue={item.logoUrl ?? ""}
              id={`model-logo-${item.key}`}
              name="logoUrl"
              placeholder="https://…/logo.svg"
              type="url"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              建议使用官方或已上传到 R2 的 SVG/PNG；留空时使用内置品牌图标。
            </p>
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor={`model-color-${item.key}`}>
              品牌色
            </label>
            <Input
              defaultValue={item.brandColor ?? ""}
              id={`model-color-${item.key}`}
              maxLength={7}
              name="brandColor"
              pattern="#[0-9A-Fa-f]{6}"
              placeholder="#4285F4"
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor={`model-site-${item.key}`}>
              官方地址
            </label>
            <Input
              defaultValue={item.websiteUrl ?? ""}
              id={`model-site-${item.key}`}
              name="websiteUrl"
              placeholder="https://"
              type="url"
            />
          </div>
          <div className="flex min-h-11 flex-wrap items-center justify-between gap-4 border-y border-border py-3 lg:col-span-2">
            <label
              className="inline-flex min-h-11 cursor-pointer items-center gap-3 text-sm"
              htmlFor={`model-active-${item.key}`}
            >
              <input
                defaultChecked={item.active}
                id={`model-active-${item.key}`}
                name="active"
                type="checkbox"
                value="true"
              />
              在投稿与评价中启用
            </label>
            <ActionButton
              className="min-h-11 rounded-sm"
              pendingLabel="保存中"
              type="submit"
            >
              保存修改
            </ActionButton>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            英文标识 <code className="text-foreground">{item.key}</code> 创建后保持不变。
            {usageCount
              ? " 已被引用的模型可以停用，但不能永久删除。"
              : " 当前没有历史引用，可以永久删除。"}
          </p>
          {item.websiteUrl ? (
            <a
              className="inline-flex min-h-11 items-center gap-1.5 underline underline-offset-4 hover:text-primary"
              href={item.websiteUrl}
              rel="noreferrer"
              target="_blank"
            >
              查看官网
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          ) : null}
        </div>

        {!usageCount ? (
          <details className="mt-2 ml-auto w-fit">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-xs text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Trash2 aria-hidden="true" className="size-3.5" />
              永久删除
            </summary>
            <form action={deleteAiTool} className="mt-2 flex items-center gap-3 border border-destructive/30 bg-destructive/5 p-3">
              <input name="key" type="hidden" value={item.key} />
              <input name="name" type="hidden" value={item.name} />
              <p className="max-w-sm text-xs leading-5 text-muted-foreground">
                删除后不能恢复。若只是暂时不提供选择，请关闭“启用”。
              </p>
              <ActionButton
                className="min-h-11 shrink-0 rounded-sm"
                pendingLabel="删除中"
                type="submit"
                variant="destructive"
              >
                确认删除
              </ActionButton>
            </form>
          </details>
        ) : null}
      </div>
    </details>
  );
}

export default function AdminModelsPage(props: ModelsPageProps) {
  return (
    <Suspense fallback={<ModelsFallback />}>
      <ModelsContent {...props} />
    </Suspense>
  );
}

async function ModelsContent({ searchParams }: ModelsPageProps) {
  const [raw, data] = await Promise.all([searchParams, getAdminAiTools()]);
  const error = firstMessage(raw.error);
  const success = firstMessage(raw.success);
  const nextOrder = Math.max(0, ...data.items.map((item) => item.sortOrder)) + 1;

  return (
    <main>
      <AdminPageHeader
        description="统一维护投稿、作品详情和实测心得中的可选模型；停用只影响新的选择，历史记录仍会保留名称与 Logo。"
        eyebrow="Model Directory · 模型"
        title="模型管理"
      />
      {error ? <AdminNotice kind="error" text={error} /> : null}
      {success ? <AdminNotice kind="success" text={success} /> : null}
      {data.error ? <AdminNotice kind="error" text={data.error} /> : null}

      <section aria-labelledby="new-model-heading" className="mt-8">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-primary uppercase">
              Register
            </p>
            <h2 className="mt-1 font-serif text-2xl" id="new-model-heading">
              登记生成模型
            </h2>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.items.filter((item) => item.active).length} 个启用
          </span>
        </div>
        <form
          action={saveAiTool}
          className="mt-5 grid gap-4 border-y border-border bg-muted/15 p-4 md:grid-cols-2 xl:grid-cols-3"
        >
          <input name="intent" type="hidden" value="create" />
          <input name="active" type="hidden" value="true" />
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="new-model-name">
              显示名称
            </label>
            <Input
              id="new-model-name"
              maxLength={48}
              name="name"
              placeholder="例如 Gemini"
              required
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="new-model-key">
              英文标识
            </label>
            <Input
              id="new-model-key"
              name="key"
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="gemini"
              required
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="new-model-order">
              排序
            </label>
            <Input
              defaultValue={nextOrder}
              id="new-model-order"
              max={32767}
              min={1}
              name="sortOrder"
              required
              type="number"
            />
          </div>
          <div className={`${fieldClass} md:col-span-2 xl:col-span-3`}>
            <label className={labelClass} htmlFor="new-model-description">
              简短说明
            </label>
            <Input
              id="new-model-description"
              maxLength={160}
              name="description"
              placeholder="帮助投稿者区分模型或产品版本（可选）"
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="new-model-logo">
              Logo 地址
            </label>
            <Input
              id="new-model-logo"
              name="logoUrl"
              placeholder="https://…/logo.svg"
              type="url"
            />
            <p className="text-xs leading-5 text-muted-foreground">
              推荐将 LobeHub Icons 或官方素材上传到 R2 后填写，避免依赖外部 CDN。
            </p>
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="new-model-color">
              品牌色
            </label>
            <Input
              id="new-model-color"
              maxLength={7}
              name="brandColor"
              pattern="#[0-9A-Fa-f]{6}"
              placeholder="#4285F4"
            />
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="new-model-site">
              官方地址
            </label>
            <Input
              id="new-model-site"
              name="websiteUrl"
              placeholder="https://"
              type="url"
            />
          </div>
          <ActionButton
            className="min-h-11 self-end rounded-sm"
            pendingLabel="添加中"
            type="submit"
          >
            <Plus aria-hidden="true" />
            添加模型
          </ActionButton>
        </form>
      </section>

      <section aria-labelledby="models-heading" className="mt-10">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-primary uppercase">
              Directory
            </p>
            <h2 className="mt-1 font-serif text-2xl" id="models-heading">
              当前目录
            </h2>
          </div>
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Bot aria-hidden="true" className="size-4" />
            {data.items.length} 个模型
          </span>
        </div>
        {data.items.length ? (
          <div>{data.items.map((item) => <ModelRow item={item} key={item.key} />)}</div>
        ) : (
          <div className="border-b border-border py-12 text-center">
            <Bot aria-hidden="true" className="mx-auto size-5 text-primary" />
            <p className="mt-3 font-serif text-lg">还没有生成模型</p>
            <p className="mt-1 text-sm text-muted-foreground">
              先登记一个模型，投稿和实测心得中才会出现选择项。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
