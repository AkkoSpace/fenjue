"use client";

import { Check } from "lucide-react";

import {
  AI_TOOL_OPTIONS,
  type AiToolKey,
} from "@/lib/content/ai-tools";
import { cn } from "@/lib/utils";

interface VerifiedToolsSelectorProps {
  disabled?: boolean;
  onChange: (value: AiToolKey[]) => void;
  value: AiToolKey[];
}

export function VerifiedToolsSelector({
  disabled = false,
  onChange,
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
      <legend className="text-sm font-medium text-foreground">已验证工具</legend>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        选择实际生成或验证过的工具，可以多选；尚未验证可以留空。
      </p>
      <div className="mt-3 grid grid-cols-2 gap-px border border-border bg-border">
        {AI_TOOL_OPTIONS.map((option) => {
          const checked = selected.has(option.value);

          return (
            <label
              className={cn(
                "relative flex min-h-14 cursor-pointer items-center justify-between gap-2 bg-background px-3 py-2.5 outline-none transition-colors has-focus-visible:z-10 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset",
                checked
                  ? "z-10 bg-primary/5 text-primary outline-1 -outline-offset-1 outline-primary"
                  : "text-foreground hover:bg-muted/60",
                disabled && "cursor-not-allowed opacity-50",
              )}
              key={option.value}
            >
              <input
                checked={checked}
                className="sr-only"
                name="verified-tools"
                onChange={() => toggle(option.value)}
                type="checkbox"
                value={option.value}
              />
              <span className="text-sm font-medium">{option.label}</span>
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
    </fieldset>
  );
}
