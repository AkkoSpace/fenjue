"use client";

import { Check } from "lucide-react";

import { AiToolMark } from "@/components/ai-tool-mark";
import {
  MAX_VERIFIED_AI_TOOLS,
  type AiTool,
  type AiToolKey,
} from "@/lib/content/ai-tools";
import { cn } from "@/lib/utils";

interface VerifiedToolsSelectorProps {
  disabled?: boolean;
  onChange: (value: AiToolKey[]) => void;
  tools: AiTool[];
  value: AiToolKey[];
}

export function VerifiedToolsSelector({
  disabled = false,
  onChange,
  tools,
  value,
}: VerifiedToolsSelectorProps) {
  const selected = new Set(value);

  function toggle(tool: AiToolKey) {
    onChange(
      selected.has(tool)
        ? value.filter((item) => item !== tool)
        : [...value, tool],
    );
  }

  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">已验证模型</legend>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        选择实际生成或验证过的模型，最多 4 个；尚未验证可以留空。
      </p>
      {tools.length ? (
        <div className="mt-3 grid grid-cols-1 gap-px border border-border bg-border sm:grid-cols-2">
          {tools.map((tool) => {
            const checked = selected.has(tool.key);
            const unavailable =
              !checked &&
              (!tool.active || selected.size >= MAX_VERIFIED_AI_TOOLS);

            return (
              <label
                className={cn(
                  "relative flex min-h-16 cursor-pointer items-center gap-2.5 bg-background px-3 py-2.5 outline-none transition-colors has-focus-visible:z-10 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset",
                  checked
                    ? "z-10 bg-primary/5 text-primary outline-1 -outline-offset-1 outline-primary"
                    : "text-foreground hover:bg-muted/60",
                  (disabled || unavailable) && "cursor-not-allowed opacity-50",
                )}
                key={tool.key}
              >
                <input
                  checked={checked}
                  className="sr-only"
                  disabled={unavailable}
                  name="verified-tools"
                  onChange={() => toggle(tool.key)}
                  type="checkbox"
                  value={tool.key}
                />
                <AiToolMark className="size-8" tool={tool} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {tool.name}
                  </span>
                  {tool.description ? (
                    <span className="mt-0.5 block truncate text-[0.6875rem] text-muted-foreground">
                      {tool.description}
                    </span>
                  ) : !tool.active ? (
                    <span className="mt-0.5 block text-[0.6875rem] text-muted-foreground">
                      已停用 · 仅保留历史记录
                    </span>
                  ) : null}
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
          当前没有启用的生成模型，仍可继续提交并留空此项。
        </p>
      )}
    </fieldset>
  );
}
