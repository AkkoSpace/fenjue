"use client";

import { useState } from "react";

import { BrandIcon, hasBrandIcon } from "@/components/brand-icon";
import { cn } from "@/lib/utils";

interface BrandMarkProps {
  brandKey?: string | null;
  brandColor?: string | null;
  className?: string;
  name: string;
  logoUrl?: string | null;
}

export function BrandMark({
  brandKey,
  brandColor,
  className,
  logoUrl,
  name,
}: BrandMarkProps) {
  const [failed, setFailed] = useState(false);
  const initial = [...name.trim()][0]?.toLocaleUpperCase("zh-CN") ?? "焚";
  const color = /^#[0-9a-f]{6}$/i.test(brandColor ?? "")
    ? brandColor
    : undefined;
  const hasLogo = Boolean(logoUrl) && !failed;
  const hasFallbackIcon = hasBrandIcon(brandKey, name);
  const usesColorFallback = !hasLogo && !hasFallbackIcon && color;

  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative grid size-8 shrink-0 place-items-center overflow-hidden border border-border bg-background font-serif text-xs font-medium text-foreground",
        usesColorFallback && "border-transparent text-white",
        className,
      )}
      style={usesColorFallback ? { backgroundColor: color } : undefined}
    >
      {hasLogo ? (
        // Administrator-managed brand assets are intentionally rendered directly.
        // This avoids coupling the catalog to Next image hostname configuration.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-full object-contain p-1"
          decoding="async"
          loading="eager"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
          src={logoUrl!}
        />
      ) : hasFallbackIcon ? (
        <BrandIcon
          brandKey={brandKey}
          className="size-full"
          name={name}
        />
      ) : (
        initial
      )}
    </span>
  );
}
