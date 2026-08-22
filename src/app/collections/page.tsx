import { BookOpenText } from "lucide-react";
import type { Metadata, Route } from "next";
import Image from "next/image";
import Link from "next/link";

import { JsonLd } from "@/components/json-ld";
import { getPublishedCollections } from "@/lib/content/editorial-queries";
import { absoluteUrl } from "@/lib/site";

export const instant = false;

export const metadata: Metadata = {
  alternates: { canonical: "/collections" },
  description: "浏览焚诀编辑整理的 AI 文生图提示词专栏，按用途、风格与创作场景系统发现值得复用的提示词。",
  title: "提示词专栏",
};

export default async function CollectionsPage() {
  const collections = await getPublishedCollections();
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    hasPart: collections.map((collection) => ({
      "@type": "CollectionPage",
      name: collection.title,
      url: absoluteUrl(`/collections/${collection.slug}`),
    })),
    name: "焚诀提示词专栏",
    url: absoluteUrl("/collections"),
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-10">
      <JsonLd data={structuredData} />
      <div className="max-w-3xl border-b border-border pb-7">
        <p className="text-xs tracking-[0.18em] text-primary uppercase">
          Collections · 专栏
        </p>
        <h1 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
          按主题修习，而不只是一张张浏览
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
          专栏由编辑把用途、风格或创作场景相近的提示词整理为有顺序的目录。
        </p>
      </div>

      {collections.length ? (
        <section aria-label="已发布专栏" className="divide-y divide-border">
          {collections.map((collection, index) => (
            <article
              className="grid gap-5 py-7 md:grid-cols-[minmax(15rem,0.65fr)_minmax(0,1fr)] md:items-center md:gap-8"
              key={collection.id}
            >
              <Link
                aria-label={`查看专栏${collection.title}`}
                className="group relative block min-h-48 overflow-hidden bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                href={`/collections/${collection.slug}` as Route}
              >
                {collection.cover?.src ? (
                  <Image
                    alt={collection.cover.alt}
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
                    fill
                    priority={index === 0}
                    sizes="(max-width: 767px) 100vw, 38vw"
                    src={collection.cover.src}
                  />
                ) : (
                  <span className="grid min-h-48 place-items-center border border-border text-primary">
                    <BookOpenText aria-hidden="true" className="size-6" />
                  </span>
                )}
              </Link>
              <div>
                <p className="text-xs tracking-[0.16em] text-primary uppercase">
                  专栏 · {String(index + 1).padStart(2, "0")}
                </p>
                <Link
                  className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  href={`/collections/${collection.slug}` as Route}
                >
                  <h2 className="mt-1 font-serif text-2xl text-foreground transition-colors hover:text-primary sm:text-3xl">
                    {collection.title}
                  </h2>
                </Link>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                  {collection.description}
                </p>
                <p className="mt-4 text-xs tabular-nums text-muted-foreground">
                  收录 {collection.promptCount} 条焚诀
                </p>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <div className="py-16 text-center">
          <BookOpenText aria-hidden="true" className="mx-auto size-6 text-primary" />
          <h2 className="mt-3 font-serif text-xl text-foreground">专栏正在编纂</h2>
          <p className="mt-2 text-sm text-muted-foreground">发布后会在这里形成完整目录。</p>
        </div>
      )}
    </main>
  );
}
