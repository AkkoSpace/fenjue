import { AlertCircle, ArrowLeft } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import {
  PromptEditor,
  type PromptEditorInitialValue,
} from "@/components/submission/prompt-editor";
import { getActiveAiTools } from "@/lib/content/ai-tool-queries";
import { aiToolFromRelation, type AiToolRow } from "@/lib/content/ai-tools";
import { isContentRelation } from "@/lib/content/relation";
import { getContentTaxonomy } from "@/lib/content/queries";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  description: "修改待审核或被驳回的投稿，并重新提交审核。",
  robots: { follow: false, index: false },
  title: "修改投稿",
};

interface EditSubmissionPageProps {
  params: Promise<{ id: string }>;
}

interface EditablePromptRow {
  author_name: string;
  author_url: string;
  category_key: string;
  content_relation: string;
  id: string;
  is_nsfw: boolean;
  prompt: string;
  prompt_ai_tools: {
    tool: AiToolRow | AiToolRow[] | null;
  }[];
  prompt_images: {
    alt: string;
    height: number;
    id: string;
    object_key: string;
    position: number;
    width: number;
  }[];
  prompt_tags: { tag_key: string }[];
  review_note: string | null;
  review_status: "approved" | "pending" | "rejected";
  source_url: string;
  title: string;
}

export default function EditSubmissionPage(props: EditSubmissionPageProps) {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-5 pt-8 sm:px-8 sm:pt-10">
          <div className="h-10 max-w-sm animate-pulse bg-muted motion-reduce:animate-none" />
        </main>
      }
    >
      <EditSubmissionContent {...props} />
    </Suspense>
  );
}

async function EditSubmissionContent({ params }: EditSubmissionPageProps) {
  if (!hasSupabasePublicConfig()) redirect("/login?next=/account");

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email_confirmed_at) {
    redirect(`/login?next=${encodeURIComponent(`/account/submissions/${id}/edit`)}`);
  }

  const [promptResult, taxonomy, activeTools] = await Promise.all([
    supabase
      .from("prompts")
      .select(
        "id,title,prompt,author_name,author_url,source_url,is_nsfw,content_relation,category_key,review_status,review_note,prompt_images(id,position,object_key,alt,width,height),prompt_tags(tag_key),prompt_ai_tools(tool:ai_tools!prompt_ai_tools_tool_key_fkey(key,name,description,logo_url,website_url,active,sort_order))",
      )
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    getContentTaxonomy(),
    getActiveAiTools(),
  ]);

  if (promptResult.error) {
    console.warn("Unable to load owned prompt for editing", promptResult.error.code);
    throw new Error("投稿加载失败，请返回账户页后重试。");
  }
  if (!promptResult.data) notFound();

  const prompt = promptResult.data as unknown as EditablePromptRow;
  if (prompt.review_status === "approved") {
    const query = new URLSearchParams({
      error: "已公开作品暂时不能直接修改。如需更正，请联系管理员。",
    });
    redirect(`/account?${query.toString()}` as Route);
  }
  if (!isContentRelation(prompt.content_relation)) {
    throw new Error("投稿的内容关系无效，请联系管理员处理。");
  }

  const historicalTools = prompt.prompt_ai_tools
    .map((relation) => aiToolFromRelation(relation.tool))
    .filter((tool) => tool !== null);
  const toolMap = new Map(activeTools.map((tool) => [tool.key, tool]));
  historicalTools.forEach((tool) => toolMap.set(tool.key, tool));
  const r2BaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!r2BaseUrl) throw new Error("图片公开地址尚未配置。");

  const initialValue: PromptEditorInitialValue = {
    authorName: prompt.author_name,
    authorUrl: prompt.author_url,
    categoryKey: prompt.category_key,
    contentRelation: prompt.content_relation,
    id: prompt.id,
    images: [...prompt.prompt_images]
      .sort((left, right) => left.position - right.position)
      .map((image) => ({
        alt: image.alt,
        height: image.height,
        id: image.id,
        objectKey: image.object_key,
        src: `${r2BaseUrl}/${image.object_key}`,
        width: image.width,
      })),
    isNsfw: prompt.is_nsfw,
    prompt: prompt.prompt,
    sourceUrl: prompt.source_url,
    tagKeys: prompt.prompt_tags.map((tag) => tag.tag_key),
    title: prompt.title,
    verifiedTools: historicalTools.map((tool) => tool.key),
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-10">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        href="/account"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        返回我的投稿
      </Link>

      <div className="mt-5 max-w-2xl">
        <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
          Submission Revision · 修订
        </p>
        <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">
          修改并重新提交
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          保存后会清除旧审核结论并重新进入待审核，修改不会直接公开。
        </p>
      </div>

      {prompt.review_status === "rejected" && prompt.review_note ? (
        <div className="mt-7 flex max-w-3xl items-start gap-3 border-y border-destructive/25 bg-destructive/5 px-4 py-4 text-sm leading-6">
          <AlertCircle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-destructive"
          />
          <div>
            <p className="font-medium text-foreground">需要修改的原因</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
              {prompt.review_note}
            </p>
          </div>
        </div>
      ) : null}

      <PromptEditor
        aiTools={[...toolMap.values()].sort(
          (left, right) => left.sortOrder - right.sortOrder,
        )}
        categories={taxonomy.categories}
        defaultAuthorName={prompt.author_name}
        initialValue={initialValue}
        tags={taxonomy.tags}
      />
    </main>
  );
}
