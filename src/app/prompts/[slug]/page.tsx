import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PromptCopyButton } from "@/components/prompt-copy-button";
import { PromptGallery } from "@/components/prompt-gallery";
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
    description: `查看“${entry.title}”的完整文生图提示词。`,
  };
}

export default async function PromptPage({ params }: PromptPageProps) {
  const { slug } = await params;
  const entry = await getPromptBySlug(slug);

  if (!entry) {
    notFound();
  }

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

        <PromptGallery images={entry.images} title={entry.title} />

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
