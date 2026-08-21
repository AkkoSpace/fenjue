import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PromptCopyButton } from "@/components/prompt-copy-button";
import { PromptGallery } from "@/components/prompt-gallery";
import { SensitiveImageGuard } from "@/components/sensitive-image-guard";
import { getAiToolOption } from "@/lib/content/ai-tools";
import { getContentRelationOption } from "@/lib/content/relation";
import { getPromptBySlug } from "@/lib/content/queries";

export const instant = false;

interface PromptPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PromptPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getPromptBySlug(slug);

  if (!entry) {
    return {};
  }

  return {
    title: `${entry.title} · 焚诀`,
    description: `查看“${entry.title}”的完整文生图提示词、${entry.category.name}分类与相关标签。`,
  };
}

export default async function PromptPage({ params }: PromptPageProps) {
  const { slug } = await params;
  const entry = await getPromptBySlug(slug);

  if (!entry) {
    notFound();
  }

  const contentRelation = getContentRelationOption(entry.contentRelation);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-7 sm:px-8 sm:pt-9">
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        href="/"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        返回作品流
      </Link>

      <article className="mt-5 sm:mt-7">
        <h1 className="mb-5 max-w-4xl font-serif text-3xl leading-tight text-foreground sm:mb-7 sm:text-4xl">
          {entry.title}
        </h1>

        {entry.isNsfw ? (
          <SensitiveImageGuard title={entry.title}>
            <PromptGallery images={entry.images} title={entry.title} />
          </SensitiveImageGuard>
        ) : (
          <PromptGallery images={entry.images} title={entry.title} />
        )}

        <div className="mt-7 grid gap-8 border-t border-border/80 pt-6 sm:mt-9 sm:pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.34fr)] lg:gap-12">
          <section aria-labelledby="prompt-heading">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2
                id="prompt-heading"
                className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase"
              >
                完整提示词
              </h2>
              <PromptCopyButton prompt={entry.prompt} />
            </div>
            <p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-7 text-foreground/88 sm:text-base sm:leading-8">
              {entry.prompt}
            </p>
          </section>

          <aside className="border-t border-border/80 pt-5 text-sm text-muted-foreground lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
            <p className="mb-2 text-xs font-medium tracking-[0.18em] uppercase">
              作者与来源
            </p>
            <p className="mb-2 flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">内容关系</span>
              <span className="border border-border px-1.5 py-0.5 font-medium text-foreground">
                {contentRelation.label}
              </span>
            </p>
            <div className="mb-3 border-y border-border/70 py-3">
              <p className="text-xs text-muted-foreground">分类与标签</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Link
                  className="inline-flex min-h-9 items-center border border-primary/30 bg-primary/5 px-2 text-xs font-medium text-foreground transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  href={`/?category=${encodeURIComponent(entry.category.key)}` as Route}
                >
                  {entry.category.name}
                </Link>
                {entry.tags.map((tag) => (
                  <Link
                    className="inline-flex min-h-9 items-center border border-border px-2 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    href={`/?tag=${encodeURIComponent(tag.key)}` as Route}
                    key={tag.key}
                  >
                    #{tag.name}
                  </Link>
                ))}
              </div>
            </div>
            {entry.verifiedTools.length ? (
              <div className="mb-3 border-b border-border/70 pb-3">
                <p className="text-xs text-muted-foreground">已验证工具</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {entry.verifiedTools.map((tool) => (
                    <span
                      className="border border-primary/25 bg-primary/5 px-2 py-1 text-xs font-medium text-foreground"
                      key={tool}
                    >
                      {getAiToolOption(tool).label}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <a
              className="flex min-h-11 items-center underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              href={entry.author.url}
              target="_blank"
              rel="noreferrer"
            >
              {entry.author.name}
            </a>
            <a
              className="inline-flex min-h-11 items-center gap-1.5 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
              href={entry.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              查看原始内容
              <ExternalLink className="size-3.5" aria-hidden="true" />
              <span className="sr-only">，在新窗口打开</span>
            </a>
          </aside>
        </div>
      </article>
    </main>
  );
}
