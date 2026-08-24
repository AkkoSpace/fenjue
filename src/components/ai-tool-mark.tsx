"use client";

import { useState } from "react";

import type { AiTool } from "@/lib/content/ai-tools";
import { cn } from "@/lib/utils";

interface AiToolMarkProps {
  className?: string;
  tool: Pick<AiTool, "logoUrl" | "name">;
}

export function AiToolMark({ className, tool }: AiToolMarkProps) {
  const [failed, setFailed] = useState(false);
  const initial = [...tool.name.trim()][0]?.toLocaleUpperCase("zh-CN") ?? "模";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-8 shrink-0 place-items-center overflow-hidden border border-border bg-muted font-serif text-xs font-medium text-foreground",
        className,
      )}
    >
      {tool.logoUrl && !failed ? (
        // Model logos are tiny third-party assets; bypassing Next image optimization
        // avoids coupling an administrator-managed directory to a hostname allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-full object-contain"
          decoding="async"
          loading="lazy"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={tool.logoUrl}
        />
      ) : (
        initial
      )}
    </span>
  );
}
