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

const DEFAULT_BRAND_ASSET_URLS: Record<string, string> = {
  // Official platform favicons mirrored to our own R2 so the public site does
  // not depend on third-party hosts at render time.
  bilibili:
    "https://fenjue-images.akko.space/catalog/icons/platforms/bilibili.ico",
  xiaoheihe:
    "https://fenjue-images.akko.space/catalog/icons/platforms/xiaoheihe.ico",
  xiaohongshu:
    "https://fenjue-images.akko.space/catalog/icons/platforms/xiaohongshu.ico",
  github:
    "https://fenjue-images.akko.space/catalog/icons/platforms/github.ico",
  youtube:
    "https://fenjue-images.akko.space/catalog/icons/platforms/youtube.ico",
  douyin:
    "https://fenjue-images.akko.space/catalog/icons/platforms/douyin.ico",

  // Official model/provider marks. Nano Banana uses Google's official Gemini
  // mark, while Grok uses xAI's official mark; both are the products' own
  // published brand assets rather than hand-drawn fallbacks.
  "nano-banana":
    "https://fenjue-images.akko.space/catalog/icons/models/nano-banana.svg",
  doubao:
    "https://fenjue-images.akko.space/catalog/icons/models/doubao.png",
  grok:
    "https://fenjue-images.akko.space/catalog/icons/models/grok.ico",
  chatgpt:
    "https://fenjue-images.akko.space/catalog/icons/models/chatgpt.webp",
};

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
  const defaultLogoUrl = brandKey ? DEFAULT_BRAND_ASSET_URLS[brandKey] : undefined;
  // Treat an empty admin value like an unset value so the official default is
  // still used until a real custom asset is configured.
  const resolvedLogoUrl = logoUrl?.trim() || defaultLogoUrl;
  const hasLogo = Boolean(resolvedLogoUrl) && !failed;
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
          src={resolvedLogoUrl!}
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
