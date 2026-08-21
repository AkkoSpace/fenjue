import { FolderPlus, PencilLine, Tags } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { AdminNotice, firstMessage } from "@/components/admin/admin-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Input } from "@/components/ui/input";
import { saveTaxonomyItem } from "@/lib/admin/taxonomy-actions";
import {
  type AdminTaxonomyItem,
  type AdminTaxonomyTag,
  getAdminTaxonomy,
} from "@/lib/admin/queries";
import { TAG_KIND_LABELS, type TaxonomyTagKind } from "@/lib/content/taxonomy";

export const metadata: Metadata = {
  description: "维护焚诀主分类和受控标签。",
  title: { absolute: "分类管理｜焚诀" },
};

interface TaxonomyPageProps {
  searchParams: Promise<{
    error?: string | string[];
    success?: string | string[];
  }>;
}

const fieldClass = "space-y-2";
const labelClass = "block text-xs font-medium text-muted-foreground";
const selectClass = "flex h-11 w-full rounded-sm border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function TaxonomyFallback() {
  return <main><div className="h-24 animate-pulse bg-muted/40" /><div className="mt-8 h-96 animate-pulse bg-muted/30" /></main>;
}

function ActiveField({ active = true, id }: { active?: boolean; id: string }) {
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm" htmlFor={id}>
      <input defaultChecked={active} id={id} name="active" type="checkbox" value="true" />
      启用
    </label>
  );
}

function CategoryRow({ item }: { item: AdminTaxonomyItem }) {
  return (
    <details className="group border-b border-border">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium">
            {item.name}
            <span className={item.active ? "text-xs text-emerald-700" : "text-xs text-muted-foreground"}>{item.active ? "启用" : "停用"}</span>
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{item.key} · 排序 {item.sortOrder} · {item.usageCount} 条内容（{item.publishedCount} 条公开）</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground group-open:text-primary"><PencilLine aria-hidden="true" className="size-4" />编辑</span>
      </summary>
      <form action={saveTaxonomyItem} className="grid gap-4 border-t border-dashed border-border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto_auto] sm:items-end">
        <input name="entity" type="hidden" value="category" />
        <input name="intent" type="hidden" value="update" />
        <input name="key" type="hidden" value={item.key} />
        <input name="returnTo" type="hidden" value="/admin/taxonomy" />
        <div className={fieldClass}><label className={labelClass} htmlFor={`category-name-${item.key}`}>分类名称</label><Input defaultValue={item.name} id={`category-name-${item.key}`} maxLength={32} name="name" required /></div>
        <div className={fieldClass}><label className={labelClass} htmlFor={`category-order-${item.key}`}>排序</label><Input defaultValue={item.sortOrder} id={`category-order-${item.key}`} max={32767} min={1} name="sortOrder" required type="number" /></div>
        <ActiveField active={item.active} id={`category-active-${item.key}`} />
        <ActionButton className="min-h-11 rounded-sm" pendingLabel="保存中" type="submit">保存</ActionButton>
      </form>
    </details>
  );
}

function TagRow({ item }: { item: AdminTaxonomyTag }) {
  return (
    <details className="group border-b border-border">
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium">{item.name}<span className={item.active ? "text-xs text-emerald-700" : "text-xs text-muted-foreground"}>{item.active ? "启用" : "停用"}</span></span>
          <span className="mt-1 block truncate text-xs text-muted-foreground">{TAG_KIND_LABELS[item.kind]} · {item.key} · 排序 {item.sortOrder} · {item.usageCount} 条内容</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2 text-sm text-muted-foreground group-open:text-primary"><PencilLine aria-hidden="true" className="size-4" />编辑</span>
      </summary>
      <form action={saveTaxonomyItem} className="grid gap-4 border-t border-dashed border-border bg-muted/20 p-4 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto_auto] sm:items-end">
        <input name="entity" type="hidden" value="tag" />
        <input name="intent" type="hidden" value="update" />
        <input name="key" type="hidden" value={item.key} />
        <input name="returnTo" type="hidden" value="/admin/taxonomy" />
        <div className={fieldClass}><label className={labelClass} htmlFor={`tag-name-${item.key}`}>标签名称</label><Input defaultValue={item.name} id={`tag-name-${item.key}`} maxLength={32} name="name" required /></div>
        <div className={fieldClass}><label className={labelClass} htmlFor={`tag-kind-${item.key}`}>类型</label><select className={selectClass} defaultValue={item.kind} id={`tag-kind-${item.key}`} name="kind">{Object.entries(TAG_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
        <div className={fieldClass}><label className={labelClass} htmlFor={`tag-order-${item.key}`}>排序</label><Input defaultValue={item.sortOrder} id={`tag-order-${item.key}`} max={32767} min={1} name="sortOrder" required type="number" /></div>
        <ActiveField active={item.active} id={`tag-active-${item.key}`} />
        <ActionButton className="min-h-11 rounded-sm" pendingLabel="保存中" type="submit">保存</ActionButton>
      </form>
    </details>
  );
}

export default function AdminTaxonomyPage(props: TaxonomyPageProps) {
  return <Suspense fallback={<TaxonomyFallback />}><TaxonomyContent {...props} /></Suspense>;
}

async function TaxonomyContent({ searchParams }: TaxonomyPageProps) {
  const raw = await searchParams;
  const data = await getAdminTaxonomy();
  const error = firstMessage(raw.error);
  const success = firstMessage(raw.success);
  const nextCategoryOrder = Math.max(0, ...data.categories.map((item) => item.sortOrder)) + 1;
  const nextTagOrder = Math.max(0, ...data.tags.map((item) => item.sortOrder)) + 1;
  const tagGroups = (Object.keys(TAG_KIND_LABELS) as TaxonomyTagKind[]).map((kind) => ({ kind, items: data.tags.filter((tag) => tag.kind === kind) }));

  return (
    <main>
      <AdminPageHeader description="分类决定作品的主要归属，标签用于风格、形式与主题筛选；标识创建后保持不变。" eyebrow="Taxonomy · 分类" title="分类管理" />
      {error ? <AdminNotice kind="error" text={error} /> : null}
      {success ? <AdminNotice kind="success" text={success} /> : null}
      {data.error ? <AdminNotice kind="error" text={data.error} /> : null}

      <div className="mt-8 grid items-start gap-10 xl:grid-cols-2">
        <section aria-labelledby="categories-heading">
          <div className="flex items-end justify-between gap-4 border-b border-border pb-3"><div><p className="text-xs tracking-[0.16em] text-primary uppercase">Primary</p><h2 className="mt-1 font-serif text-2xl" id="categories-heading">主分类</h2></div><span className="text-xs text-muted-foreground">{data.categories.length} 个</span></div>
          <form action={saveTaxonomyItem} className="mt-5 grid gap-4 border-y border-border bg-muted/15 p-4 sm:grid-cols-2">
            <input name="entity" type="hidden" value="category" /><input name="intent" type="hidden" value="create" /><input name="active" type="hidden" value="true" /><input name="returnTo" type="hidden" value="/admin/taxonomy" />
            <div className={fieldClass}><label className={labelClass} htmlFor="new-category-name">名称</label><Input id="new-category-name" maxLength={32} name="name" placeholder="例如 动物" required /></div>
            <div className={fieldClass}><label className={labelClass} htmlFor="new-category-key">英文标识</label><Input id="new-category-key" name="key" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="animals" required /></div>
            <div className={fieldClass}><label className={labelClass} htmlFor="new-category-order">排序</label><Input defaultValue={nextCategoryOrder} id="new-category-order" max={32767} min={1} name="sortOrder" required type="number" /></div>
            <ActionButton className="min-h-11 self-end rounded-sm" pendingLabel="添加中" type="submit"><FolderPlus aria-hidden="true" />添加分类</ActionButton>
          </form>
          <div className="mt-5 border-t border-border">{data.categories.map((item) => <CategoryRow item={item} key={item.key} />)}</div>
        </section>

        <section aria-labelledby="tags-heading">
          <div className="flex items-end justify-between gap-4 border-b border-border pb-3"><div><p className="text-xs tracking-[0.16em] text-primary uppercase">Controlled Tags</p><h2 className="mt-1 font-serif text-2xl" id="tags-heading">标签</h2></div><span className="text-xs text-muted-foreground">{data.tags.length} 个</span></div>
          <form action={saveTaxonomyItem} className="mt-5 grid gap-4 border-y border-border bg-muted/15 p-4 sm:grid-cols-2">
            <input name="entity" type="hidden" value="tag" /><input name="intent" type="hidden" value="create" /><input name="active" type="hidden" value="true" /><input name="returnTo" type="hidden" value="/admin/taxonomy" />
            <div className={fieldClass}><label className={labelClass} htmlFor="new-tag-name">名称</label><Input id="new-tag-name" maxLength={32} name="name" placeholder="例如 线稿" required /></div>
            <div className={fieldClass}><label className={labelClass} htmlFor="new-tag-key">英文标识</label><Input id="new-tag-key" name="key" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="line-art" required /></div>
            <div className={fieldClass}><label className={labelClass} htmlFor="new-tag-kind">类型</label><select className={selectClass} defaultValue="style" id="new-tag-kind" name="kind">{Object.entries(TAG_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
            <div className={fieldClass}><label className={labelClass} htmlFor="new-tag-order">排序</label><Input defaultValue={nextTagOrder} id="new-tag-order" max={32767} min={1} name="sortOrder" required type="number" /></div>
            <ActionButton className="min-h-11 rounded-sm sm:col-span-2" pendingLabel="添加中" type="submit"><Tags aria-hidden="true" />添加标签</ActionButton>
          </form>
          <div className="mt-7 space-y-7">{tagGroups.map((group) => <div key={group.kind}><h3 className="border-b border-border pb-2 text-sm font-medium">{TAG_KIND_LABELS[group.kind]} <span className="ml-1 text-xs font-normal text-muted-foreground">{group.items.length}</span></h3><div>{group.items.map((item) => <TagRow item={item} key={item.key} />)}</div></div>)}</div>
        </section>
      </div>
    </main>
  );
}
