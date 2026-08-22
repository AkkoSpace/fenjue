import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { PromptCopyButton } from "@/components/prompt-copy-button";
import {
  PromptEngagementBar,
  PromptEngagementProvider,
} from "@/components/prompt-engagement";
import { PromptGallery } from "@/components/prompt-gallery";
import { SensitiveImageGuard } from "@/components/sensitive-image-guard";
import { getAiToolOption } from "@/lib/content/ai-tools";
import { getContentRelationOption } from "@/lib/content/relation";
import { getPromptBySlug } from "@/lib/content/queries";
import type { PromptEntryData } from "@/lib/content/types";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const instant = false;

interface PromptPageProps {
  params: Promise<{ slug: string }>;
}

function promptDescription(entry: PromptEntryData) {
  const tools = entry.verifiedTools
    .map((tool) => getAiToolOption(tool).label)
    .join("、");
  const raw = `在焚诀查看“${entry.title}”的完整 AI 文生图提示词、参考图片、${entry.category.name}分类与相关标签${tools ? `，已在${tools}验证` : ""}。`;
  const characters = [...raw];

  return characters.length > 155
    ? `${characters.slice(0, 154).join("")}…`
    : raw;
}

export async function generateMetadata({
  params,
}: PromptPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getPromptBySlug(slug);

  if (!entry) {
    return {};
  }

  const description = promptDescription(entry);
  const canonical = `/prompts/${entry.slug}`;
  const images = entry.images
    .filter((image) => image.src)
    .slice(0, 4)
    .map((image) => ({
      alt: image.alt,
      height: image.height,
      url: image.src!,
      width: image.width,
    }));

  return {
    alternates: { canonical },
    description,
    openGraph: {
      authors: [entry.author.url],
      description,
      images,
      publishedTime: entry.publishedAt,
      tags: entry.tags.map((tag) => tag.name),
      title: entry.title,
      type: "article",
      url: canonical,
    },
    robots: entry.isNsfw
      ? {
          follow: true,
          googleBot: { follow: true, index: false, noimageindex: true },
          index: false,
        }
      : { follow: true, index: true },
    title: entry.title,
    twitter: {
      card: "summary_large_image",
      description,
      images: images.map((image) => image.url),
      title: entry.title,
    },
  };
}

export default async function PromptPage({ params }: PromptPageProps) {
  const { slug } = await params;
  const entry = await getPromptBySlug(slug);

  if (!entry) {
    notFound();
  }

  const contentRelation = getContentRelationOption(entry.contentRelation);
  const description = promptDescription(entry);
  const canonical = absoluteUrl(`/prompts/${entry.slug}`);
  const structuredData = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          item: absoluteUrl("/"),
          name: "文生图提示词",
          position: 1,
        },
        {
          "@type": "ListItem",
          item: canonical,
          name: entry.title,
          position: 2,
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      author: {
        "@type": "Person",
        name: entry.author.name,
        url: entry.author.url,
      },
      datePublished: entry.publishedAt,
      description,
      genre: entry.category.name,
      image: entry.images.flatMap((image) => (image.src ? [image.src] : [])),
      inLanguage: "zh-CN",
      isBasedOn: entry.sourceUrl,
      interactionStatistic: [
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/ViewAction",
          userInteractionCount: entry.engagement.views,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: entry.engagement.likes,
        },
      ],
      keywords: entry.tags.map((tag) => tag.name).join("、"),
      name: entry.title,
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: absoluteUrl("/"),
      },
      url: canonical,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-7 sm:px-8 sm:pt-9">
      <JsonLd data={structuredData} />
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        href="/"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        返回作品流
      </Link>

      <PromptEngagementProvider
        initialMetrics={entry.engagement}
        slug={entry.slug}
      >
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

          <PromptEngagementBar slug={entry.slug} />

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
      </PromptEngagementProvider>
    </main>
  );
}
