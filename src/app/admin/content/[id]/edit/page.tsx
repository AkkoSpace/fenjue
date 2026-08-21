import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminPromptEditor } from "@/components/admin/admin-prompt-editor";
import { buttonVariants } from "@/components/ui/button";
import { getAdminPrompt } from "@/lib/admin/queries";
import { getContentTaxonomy } from "@/lib/content/queries";
import { cn } from "@/lib/utils";

interface EditPromptPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  description: "逐项编辑作品内容与图片。",
  title: { absolute: "编辑作品｜焚诀" },
};

function EditFallback() {
  return <main><div className="h-28 animate-pulse bg-muted/40" /><div className="mt-8 h-96 animate-pulse bg-muted/30" /></main>;
}

export default function EditPromptPage(props: EditPromptPageProps) {
  return <Suspense fallback={<EditFallback />}><EditPromptContent {...props} /></Suspense>;
}

async function EditPromptContent({ params }: EditPromptPageProps) {
  const { id } = await params;
  const [prompt, taxonomy] = await Promise.all([
    getAdminPrompt(id),
    getContentTaxonomy(),
  ]);
  if (!prompt) notFound();

  return (
    <main>
      <Link className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-primary" href="/admin/content"><ArrowLeft aria-hidden="true" className="size-4" />返回内容管理</Link>
      <AdminPageHeader
        action={prompt.published ? (
          <Link className={cn(buttonVariants({ variant: "outline" }), "min-h-11 rounded-sm")} href={`/prompts/${prompt.slug}` as Route} target="_blank"><ExternalLink aria-hidden="true" />查看公开页面</Link>
        ) : undefined}
        description={`正在编辑 ${prompt.slug}。图片移除、排序和内容修改会在点击保存后一次生效。`}
        eyebrow="Content · 单条编辑"
        title={prompt.title}
      />
      <AdminPromptEditor categories={taxonomy.categories} initial={prompt} key={`${prompt.title}:${prompt.images.map((image) => image.id).join(":")}`} tags={taxonomy.tags} />
    </main>
  );
}
