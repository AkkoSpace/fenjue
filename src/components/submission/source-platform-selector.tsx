"use client";

import { Check } from "lucide-react";

import { SourcePlatformMark } from "@/components/source-platform-mark";
import type {
  SourcePlatform,
  SourcePlatformKey,
} from "@/lib/content/source-platforms";
import { cn } from "@/lib/utils";

interface SourcePlatformSelectorProps {
  disabled?: boolean;
  onChange: (value: SourcePlatformKey | null) => void;
  platforms: SourcePlatform[];
  value: SourcePlatformKey | null;
}

export function SourcePlatformSelector({
  disabled = false,
  onChange,
  platforms,
  value,
}: SourcePlatformSelectorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">来源平台</legend>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        选择提示词最初发布的平台，便于访客识别来源；不确定时可以留空。
      </p>
      {platforms.length ? (
        <div className="mt-3 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
          <label
            className={cn(
              "relative flex min-h-16 cursor-pointer items-center gap-2.5 bg-background px-3 py-2.5 outline-none transition-colors has-focus-visible:z-10 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset",
              value === null
                ? "z-10 bg-primary/5 text-primary outline-1 -outline-offset-1 outline-primary"
                : "text-foreground hover:bg-muted/60",
            )}
          >
            <input
              checked={value === null}
              className="sr-only"
              name="source-platform"
              onChange={() => onChange(null)}
              type="radio"
              value=""
            />
            <span className="grid size-8 shrink-0 place-items-center border border-dashed border-border text-xs text-muted-foreground">
              —
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium">暂不标注</span>
            <span
              aria-hidden="true"
              className={cn(
                "grid size-5 shrink-0 place-items-center border transition-colors",
                value === null
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-transparent",
              )}
            >
              <Check className="size-3.5" strokeWidth={2.5} />
            </span>
          </label>
          {platforms.map((platform) => {
            const checked = value === platform.key;

            return (
              <label
                className={cn(
                  "relative flex min-h-16 cursor-pointer items-center gap-2.5 bg-background px-3 py-2.5 outline-none transition-colors has-focus-visible:z-10 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset",
                  checked
                    ? "z-10 bg-primary/5 text-primary outline-1 -outline-offset-1 outline-primary"
                    : "text-foreground hover:bg-muted/60",
                )}
                key={platform.key}
              >
                <input
                  checked={checked}
                  className="sr-only"
                  name="source-platform"
                  onChange={() => onChange(platform.key)}
                  type="radio"
                  value={platform.key}
                />
                <SourcePlatformMark className="size-8" platform={platform} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {platform.name}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-5 shrink-0 place-items-center border transition-colors",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-transparent",
                  )}
                >
                  <Check className="size-3.5" strokeWidth={2.5} />
                </span>
              </label>
            );
          })}
        </div>
      ) : (
        <p className="mt-3 border border-dashed border-border px-3 py-4 text-xs leading-5 text-muted-foreground">
          当前没有启用的来源平台，可以先留空，管理员之后可补充。
        </p>
      )}
    </fieldset>
  );
}
