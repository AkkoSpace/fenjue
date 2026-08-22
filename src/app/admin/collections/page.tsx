import { BookOpenText, FolderPlus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { AdminNotice, firstMessage } from "@/components/admin/admin-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveCollection } from "@/lib/admin/editorial-actions";
import {
  type AdminCollection,
  getAdminCollections,
} from "@/lib/admin/editorial-queries";

export const metadata: Metadata = {
  title: { absolute: "专栏管理｜焚诀" },
};

interface PageProps {
  searchParams: Promise<{
    error?: string | string[];
    success?: string | string[];
  }>;
}
const labelClass = "text-xs font-medium text-muted-foreground";
const fieldClass = "space-y-2";

function PublishedField({ id, published }: { id: string; published: boolean }) {
  return (
    <div className="flex min-h-11 items-center gap-3">
      <input name="published" type="hidden" value="false" />
      <input
        className="size-4 accent-primary"
        defaultChecked={published}
        id={id}
        name="published"
        type="checkbox"
        value="true"
      />
      <label className="text-sm text-foreground" htmlFor={id}>
        对外发布
      </label>
    </div>
  );
}

function CollectionEditor({ collection }: { collection: AdminCollection }) {
  return (
    <details className="border-b border-border py-4">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="min-w-0">
          <span className="block truncate font-medium text-foreground">{collection.title}</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            /{collection.slug} · {collection.promptCount} 条作品 · {collection.published ? "已发布" : "草稿"}
          </span>
        </span>
        <span className="shrink-0 text-xs text-primary">编辑</span>
      </summary>
      <form action={saveCollection} className="mt-4 grid gap-4 bg-muted/15 p-4 sm:grid-cols-2">
        <input name="intent" type="hidden" value="update" />
        <input name="id" type="hidden" value={collection.id} />
        <input name="slug" type="hidden" value={collection.slug} />
        <div className={fieldClass}>
          <label className={labelClass} htmlFor={`collection-title-${collection.id}`}>标题</label>
          <Input defaultValue={collection.title} id={`collection-title-${collection.id}`} maxLength={80} name="title" required />
        </div>
        <div className={fieldClass}>
          <label className={labelClass} htmlFor={`collection-order-${collection.id}`}>专栏排序</label>
          <Input defaultValue={collection.sortOrder} id={`collection-order-${collection.id}`} max={32767} min={1} name="sortOrder" required type="number" />
        </div>
        <div className={`${fieldClass} sm:col-span-2`}>
          <label className={labelClass} htmlFor={`collection-description-${collection.id}`}>简介</label>
          <Textarea defaultValue={collection.description} id={`collection-description-${collection.id}`} maxLength={500} name="description" required rows={4} />
        </div>
        <PublishedField id={`collection-published-${collection.id}`} published={collection.published} />
        <ActionButton className="min-h-11 rounded-sm sm:justify-self-end" pendingLabel="保存中" type="submit">
          保存专栏
        </ActionButton>
      </form>
    </details>
  );
}

function Fallback() {
  return <div className="h-96 animate-pulse bg-muted/30" />;
}

export default function AdminCollectionsPage(props: PageProps) {
  return (
    <Suspense fallback={<Fallback />}>
      <CollectionsContent {...props} />
    </Suspense>
  );
}

async function CollectionsContent({ searchParams }: PageProps) {
  const [collections, raw] = await Promise.all([
    getAdminCollections(),
    searchParams,
  ]);
  const error = firstMessage(raw.error);
  const success = firstMessage(raw.success);
  const nextOrder = Math.max(0, ...collections.map((item) => item.sortOrder)) + 1;

  return (
    <main>
      <AdminPageHeader
        description="专栏是有顺序的编辑目录；英文标识创建后保持稳定，作品归属在单条内容编辑页维护。"
        eyebrow="Collections · 专栏"
        title="专栏管理"
      />
      {error ? <AdminNotice kind="error" text={error} /> : null}
      {success ? <AdminNotice kind="success" text={success} /> : null}

      <section aria-labelledby="new-collection-heading" className="mt-8">
        <div className="border-b border-border pb-3">
          <p className="text-xs tracking-[0.16em] text-primary uppercase">New Collection</p>
          <h2 className="mt-1 font-serif text-2xl" id="new-collection-heading">新建专栏</h2>
        </div>
        <form action={saveCollection} className="mt-5 grid gap-4 border-y border-border bg-muted/15 p-4 sm:grid-cols-2">
          <input name="intent" type="hidden" value="create" />
          <input name="published" type="hidden" value="false" />
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="new-collection-title">标题</label>
            <Input id="new-collection-title" maxLength={80} name="title" placeholder="例如 国风人物修习录" required />
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="new-collection-slug">英文标识</label>
            <Input id="new-collection-slug" name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="chinese-portraits" required />
          </div>
          <div className={`${fieldClass} sm:col-span-2`}>
            <label className={labelClass} htmlFor="new-collection-description">简介</label>
            <Textarea id="new-collection-description" maxLength={500} name="description" placeholder="说明这个专栏解决什么创作需求，以及内容的选择标准。" required rows={4} />
          </div>
          <div className={fieldClass}>
            <label className={labelClass} htmlFor="new-collection-order">专栏排序</label>
            <Input defaultValue={nextOrder} id="new-collection-order" max={32767} min={1} name="sortOrder" required type="number" />
          </div>
          <ActionButton className="min-h-11 self-end rounded-sm" pendingLabel="创建中" type="submit">
            <FolderPlus aria-hidden="true" />
            创建草稿
          </ActionButton>
        </form>
      </section>

      <section aria-labelledby="collection-list-heading" className="mt-10">
        <div className="flex items-end justify-between gap-4 border-b border-border pb-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-primary uppercase">Directory</p>
            <h2 className="mt-1 font-serif text-2xl" id="collection-list-heading">专栏目录</h2>
          </div>
          <span className="text-xs text-muted-foreground">{collections.length} 个</span>
        </div>
        {collections.length ? (
          <div className="border-t border-border">
            {collections.map((collection) => (
              <CollectionEditor collection={collection} key={collection.id} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <BookOpenText aria-hidden="true" className="mx-auto size-5 text-primary" />
            <p className="mt-3 font-serif text-lg">还没有专栏</p>
          </div>
        )}
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          已发布专栏可在 <Link className="text-primary underline underline-offset-4" href="/collections" target="_blank">公开专栏页</Link> 查看；隐藏专栏不会删除作品归属。
        </p>
      </section>
    </main>
  );
}
