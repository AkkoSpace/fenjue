import type { Route } from "next";
import Link from "next/link";

import { PromptGallery } from "@/components/prompt-gallery";
import type { PromptEntryData } from "@/lib/content/types";

interface PromptEntryProps {
  entry: PromptEntryData;
}

export function PromptEntry({ entry }: PromptEntryProps) {
  return (
    <article className="mb-9 break-inside-avoid sm:mb-11">
      <Link
        aria-label={`查看${entry.title}${
          entry.images.length > 1 ? `，共 ${entry.images.length} 张图片` : ""
        }`}
        className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        href={`/prompts/${entry.slug}` as Route}
      >
        <PromptGallery coverOnly images={entry.images} title={entry.title} />
        <div className="mt-3 flex items-baseline justify-between gap-3 sm:mt-4">
          <h2 className="font-serif text-xl leading-snug text-foreground transition-colors group-hover:text-primary sm:text-2xl">
            {entry.title}
          </h2>
          {entry.images.length > 1 ? (
            <span className="shrink-0 text-xs text-muted-foreground">
              {entry.images.length} 张
            </span>
          ) : null}
        </div>
      </Link>
    </article>
  );
}
