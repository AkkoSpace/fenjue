"use client";

import { Eye } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils";

interface SensitiveImageGuardProps {
  children: ReactNode;
  compact?: boolean;
  detailHref?: Route;
  title: string;
}

export function SensitiveImageGuard({
  children,
  compact = false,
  detailHref,
  title,
}: SensitiveImageGuardProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="relative isolate">
      <div
        aria-hidden={!revealed}
        className={cn(
          "[&_img]:transition-[filter,transform] [&_img]:duration-300 [&_img]:ease-out motion-reduce:[&_img]:transition-none",
          !revealed &&
            "pointer-events-none select-none [&_img]:scale-110 [&_img]:blur-2xl",
        )}
      >
        {children}
      </div>

      {!revealed ? (
        <button
          aria-label={`“${title}”包含敏感内容，点击查看图片`}
          className="absolute inset-0 z-30 grid cursor-pointer place-items-center bg-background/20 text-foreground outline-none transition-colors hover:bg-background/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          onClick={() => setRevealed(true)}
          type="button"
        >
          <span
            className={cn(
              "inline-flex items-center gap-2 border border-border/80 bg-background/95 px-3 py-2 text-xs font-medium shadow-sm backdrop-blur-sm",
              compact && "gap-1.5 px-2 py-1 text-[0.6875rem]",
            )}
          >
            <Eye aria-hidden="true" className={compact ? "size-3" : "size-3.5"} />
            {compact ? "NSFW" : "敏感内容 · 点击查看"}
          </span>
        </button>
      ) : detailHref ? (
        <Link
          aria-label={`查看“${title}”详情`}
          className="absolute inset-0 z-30 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
          href={detailHref}
        />
      ) : null}

      <span aria-live="polite" className="sr-only">
        {revealed ? `“${title}”的敏感内容图片已显示` : ""}
      </span>
    </div>
  );
}
