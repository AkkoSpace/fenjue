import type { Route } from "next";
import Link from "next/link";

import { PromptGallery } from "@/components/prompt-gallery";
import { SensitiveImageGuard } from "@/components/sensitive-image-guard";
import type { FeaturedPrompt } from "@/lib/content/editorial";
import { cn } from "@/lib/utils";

export function FeaturedPrompts({ items }: { items: FeaturedPrompt[] }) {
  if (!items.length) return null;

  return (
    <section aria-labelledby="featured-heading" className="mb-10 border-y border-border py-6 sm:mb-12 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">
            Curated · 司录精选
          </p>
          <h2 className="mt-1 font-serif text-2xl text-foreground" id="featured-heading">
            值得先试的焚诀
          </h2>
        </div>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          由焚诀编辑从画面表现、复用价值与提示词完整度中选出。
        </p>
      </div>

      <div className="grid gap-x-6 gap-y-8 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item, index) => {
          const href = `/prompts/${item.entry.slug}` as Route;
          const label = `查看精选作品${item.entry.title}`;
          return (
            <article
              className={cn(
                "group min-w-0",
                index === 0 && "md:col-span-2 xl:grid xl:grid-cols-[minmax(0,1.45fr)_minmax(15rem,0.55fr)] xl:items-end xl:gap-6",
              )}
              key={item.entry.slug}
            >
              {item.entry.isNsfw ? (
                <SensitiveImageGuard detailHref={href} title={item.entry.title}>
                  <PromptGallery coverOnly eager={index === 0} images={item.entry.images} title={item.entry.title} />
                </SensitiveImageGuard>
              ) : (
                <Link
                  aria-label={label}
                  className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  href={href}
                  prefetch={false}
                >
                  <PromptGallery coverOnly eager={index === 0} images={item.entry.images} title={item.entry.title} />
                </Link>
              )}
              <div className={cn("mt-3", index === 0 && "xl:mt-0 xl:border-l xl:border-border xl:pl-6")}>
                <p className="text-xs tracking-[0.14em] text-primary uppercase">
                  精选 · {String(item.position).padStart(2, "0")}
                </p>
                <Link
                  className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  href={href}
                  prefetch={false}
                >
                  <h3 className="mt-1 font-serif text-xl leading-snug text-foreground transition-colors group-hover:text-primary sm:text-2xl">
                    {item.entry.title}
                  </h3>
                </Link>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {item.recommendation}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
