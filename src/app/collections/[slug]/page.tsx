import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/json-ld";
import { PageShell } from "@/components/layout/page-shell";
import { PromptEntry } from "@/components/prompt-entry";
import { getPublishedCollectionBySlug } from "@/lib/content/editorial-queries";
import { absoluteUrl } from "@/lib/site";

export const instant = false;

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}
export async function generateMetadata({
  params,
}: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = await getPublishedCollectionBySlug(slug);
  if (!collection) return {};
  return {
    alternates: { canonical: `/collections/${collection.slug}` },
    description: collection.description,
    openGraph: {
      description: collection.description,
      images: collection.cover?.src ? [collection.cover.src] : undefined,
      title: collection.title,
      type: "website",
    },
    title: collection.title,
  };
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collection = await getPublishedCollectionBySlug(slug);
  if (!collection) notFound();

  const canonical = absoluteUrl(`/collections/${collection.slug}`);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    description: collection.description,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: collection.entries.map((entry, index) => ({
        "@type": "ListItem",
        image: entry.images[0]?.src,
        name: entry.title,
        position: index + 1,
        url: absoluteUrl(`/prompts/${entry.slug}`),
      })),
      numberOfItems: collection.entries.length,
    },
    name: collection.title,
    url: canonical,
  };

  return (
    <PageShell className="pb-20 pt-8 sm:pt-10">
      <JsonLd data={structuredData} />
      <Link
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        href="/collections"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        返回专栏
      </Link>
      <div className="mb-9 mt-5 max-w-3xl border-b border-border pb-7 sm:mb-11">
        <p className="text-xs tracking-[0.18em] text-primary uppercase">
          Collection · 专栏
        </p>
        <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
          {collection.title}
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          {collection.description}
        </p>
        <p className="mt-4 text-xs tabular-nums text-muted-foreground">
          共 {collection.entries.length} 条焚诀，按编辑顺序排列
        </p>
      </div>

      {collection.entries.length ? (
        <section aria-label={collection.title} className="columns-1 gap-6 md:columns-2 2xl:columns-3">
          {collection.entries.map((entry, index) => (
            <PromptEntry eager={index === 0} entry={entry} key={entry.slug} />
          ))}
        </section>
      ) : (
        <div className="border-y border-border py-16 text-center">
          <h2 className="font-serif text-xl text-foreground">专栏还没有公开作品</h2>
          <p className="mt-2 text-sm text-muted-foreground">作品审核通过后会按编排顺序出现。</p>
        </div>
      )}
    </PageShell>
  );
}
