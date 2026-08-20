"use client";

import {
  CONTENT_RELATION_OPTIONS,
  type ContentRelation,
} from "@/lib/content/relation";
import { cn } from "@/lib/utils";

interface ContentRelationSelectorProps {
  disabled?: boolean;
  onChange: (value: ContentRelation) => void;
  value: ContentRelation;
}

export function ContentRelationSelector({
  disabled = false,
  onChange,
  value,
}: ContentRelationSelectorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend className="text-sm font-medium text-foreground">内容关系</legend>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        选择这条内容与所填作者之间的关系。
      </p>
      <div className="mt-3 grid gap-px border border-border bg-border sm:grid-cols-3">
        {CONTENT_RELATION_OPTIONS.map((option) => {
          const selected = value === option.value;

          return (
            <label
              className={cn(
                "relative min-h-20 cursor-pointer bg-background px-3 py-3 outline-none transition-colors has-focus-visible:z-10 has-focus-visible:ring-2 has-focus-visible:ring-ring has-focus-visible:ring-inset",
                selected
                  ? "z-10 bg-primary/5 outline-1 -outline-offset-1 outline-primary"
                  : "hover:bg-muted/60",
                disabled && "cursor-not-allowed opacity-50",
              )}
              key={option.value}
            >
              <input
                checked={selected}
                className="sr-only"
                name="content-relation"
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              <span
                className={cn(
                  "block text-sm font-medium",
                  selected ? "text-primary" : "text-foreground",
                )}
              >
                {option.label}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                {option.description}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
