import { BrandMark } from "@/components/brand-mark";
import type { SourcePlatform } from "@/lib/content/source-platforms";

interface SourcePlatformMarkProps {
  className?: string;
  platform: Pick<SourcePlatform, "brandColor" | "key" | "logoUrl" | "name">;
}

export function SourcePlatformMark({ className, platform }: SourcePlatformMarkProps) {
  return (
    <BrandMark
      brandKey={platform.key}
      brandColor={platform.brandColor}
      className={className}
      logoUrl={platform.logoUrl}
      name={platform.name}
    />
  );
}
