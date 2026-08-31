"use client";

import { BrandMark } from "@/components/brand-mark";
import type { AiTool } from "@/lib/content/ai-tools";

interface AiToolMarkProps {
  className?: string;
  tool: Pick<AiTool, "brandColor" | "key" | "logoUrl" | "name">;
}

export function AiToolMark({ className, tool }: AiToolMarkProps) {
  return (
    <BrandMark
      brandKey={tool.key}
      brandColor={tool.brandColor}
      className={className}
      logoUrl={tool.logoUrl}
      name={tool.name}
    />
  );
}
