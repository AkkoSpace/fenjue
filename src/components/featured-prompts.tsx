import type { Route } from "next";
import Link from "next/link";

import { PromptGallery } from "@/components/prompt-gallery";
import { SensitiveImageGuard } from "@/components/sensitive-image-guard";
import type { FeaturedPrompt } from "@/lib/content/editorial";
import { cn } from "@/lib/utils";

interface FeaturedPromptsProps {
  className?: string;
  items: FeaturedPrompt[];
}

const FEATURED_IMAGE_SIZES =
  "(max-width: 767px) calc(100vw - 40px), (max-width: 1279px) calc((100vw - 88px) / 2), (max-width: 1535px) 308px, 248px";

export function FeaturedPrompts({
  className,
  items,
}: FeaturedPromptsProps) {
  if (!items.length) {
    return null;
  }

  return (
    <section
      aria-labelledby="featured-heading"
      className={cn(
        "border-y border-border py-5 min-[128rem]:sticky min-[128rem]:top-24 min-[128rem]:border-y-0 min-[128rem]:py-0",
        className,
      )}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 min-[128rem]:block min-[128rem]:border-b min-[128rem]:border-border min-[128rem]:pb-4">
        <div>
          <p className="text-xs tracking-[0.18em] text-primary uppercase">
            Curated · 司录精选
          </p>
          <h2 className="mt-1 font-serif text-2xl text-foreground min-[128rem]:text-xl" id="featured-heading">
            值得先试
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground min-[128rem]:mt-2 min-[128rem]:text-xs min-[128rem]:leading-5">
          由焚诀编辑从画面表现、复用价值与提示词完整度中选出。
        </p>
      </div>

      <div className="grid gap-x-5 gap-y-7 sm:grid-cols-2 min-[128rem]:grid-cols-1 min-[128rem]:gap-y-5">
        {items.slice(0, 4).map((item, index) => {
          const href = `/prompts/${item.entry.slug}` as Route;
          const label = `查看精选作品${item.entry.title}`;
          return (
            <article
              className={cn(
                "group min-w-0 border-b border-border/80 pb-5",
                index > 1 && "min-[128rem]:hidden",
              )}
              key={item.entry.slug}
            >
              {item.entry.isNsfw ? (
                <SensitiveImageGuard detailHref={href} title={item.entry.title}>
                  <PromptGallery
                    coverOnly
                    images={item.entry.images}
                    sizes={FEATURED_IMAGE_SIZES}
                    title={item.entry.title}
                  />
                </SensitiveImageGuard>
              ) : (
                <Link
                  aria-label={label}
                  className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  href={href}
                  prefetch={false}
                >
                  <PromptGallery
                    coverOnly
                    images={item.entry.images}
                    sizes={FEATURED_IMAGE_SIZES}
                    title={item.entry.title}
                  />
                </Link>
              )}
              <div className="mt-3">
                <p className="text-xs tracking-[0.14em] text-primary uppercase">
                  精选 · {String(item.position).padStart(2, "0")}
                </p>
                <Link
                  className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                  href={href}
                  prefetch={false}
                >
                  <h3 className="mt-1 line-clamp-2 font-serif text-xl leading-snug text-foreground transition-colors group-hover:text-primary min-[128rem]:text-lg">
                    {item.entry.title}
                  </h3>
                </Link>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground min-[128rem]:text-xs min-[128rem]:leading-5">
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
