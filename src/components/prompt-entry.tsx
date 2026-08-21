import type { Route } from "next";
import Link from "next/link";

import { PromptGallery } from "@/components/prompt-gallery";
import { SensitiveImageGuard } from "@/components/sensitive-image-guard";
import type { PromptCardData } from "@/lib/content/types";

interface PromptEntryProps {
  entry: PromptCardData;
}

export function PromptEntry({ entry }: PromptEntryProps) {
  const detailHref = `/prompts/${entry.slug}` as Route;
  const detailLabel = `查看${entry.title}${
    entry.images.length > 1 ? `，共 ${entry.images.length} 张图片` : ""
  }`;

  return (
    <article className="group mb-9 break-inside-avoid sm:mb-11">
      {entry.isNsfw ? (
        <SensitiveImageGuard detailHref={detailHref} title={entry.title}>
          <PromptGallery coverOnly images={entry.images} title={entry.title} />
        </SensitiveImageGuard>
      ) : (
        <Link
          aria-label={detailLabel}
          className="block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          href={detailHref}
        >
          <PromptGallery coverOnly images={entry.images} title={entry.title} />
        </Link>
      )}

      <div className="mt-3 flex items-baseline justify-between gap-3 sm:mt-4">
        <Link
          aria-label={detailLabel}
          className="min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          href={detailHref}
        >
          <h2 className="font-serif text-xl leading-snug text-foreground transition-colors group-hover:text-primary sm:text-2xl">
            {entry.title}
          </h2>
        </Link>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {entry.isNsfw ? <span>NSFW</span> : null}
          {entry.images.length > 1 ? <span>{entry.images.length} 张</span> : null}
        </span>
      </div>
    </article>
  );
}
