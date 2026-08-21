"use client";

import {
  MAX_PROMPT_TAGS,
  TAG_KIND_LABELS,
  type TaxonomyCategory,
  type TaxonomyTag,
  type TaxonomyTagKind,
} from "@/lib/content/taxonomy";
import { cn } from "@/lib/utils";

interface TaxonomySelectorProps {
  categories: TaxonomyCategory[];
  categoryKey: string;
  disabled?: boolean;
  onCategoryChange: (key: string) => void;
  onTagKeysChange: (keys: string[]) => void;
  tagKeys: string[];
  tags: TaxonomyTag[];
}

const tagKinds: TaxonomyTagKind[] = ["style", "format", "theme"];

function optionClassName(selected: boolean, unavailable = false) {
  return cn(
    "inline-flex min-h-11 items-center border px-3 text-sm transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
    !unavailable && "cursor-pointer",
    unavailable && "cursor-not-allowed opacity-45 hover:border-border hover:text-muted-foreground",
  );
}

export function TaxonomySelector({
  categories,
  categoryKey,
  disabled = false,
  onCategoryChange,
  onTagKeysChange,
  tagKeys,
  tags,
}: TaxonomySelectorProps) {
  function toggleTag(key: string) {
    if (tagKeys.includes(key)) {
      onTagKeysChange(tagKeys.filter((tagKey) => tagKey !== key));
      return;
    }

    if (tagKeys.length < MAX_PROMPT_TAGS) {
      onTagKeysChange([...tagKeys, key]);
    }
  }

  return (
    <div className="space-y-6 border-y border-border/80 py-5">
      <fieldset>
        <legend className="text-sm font-medium text-foreground">主分类</legend>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          选择最能代表作品用途的一项，用于首页导航。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.map((category) => {
            const selected = category.key === categoryKey;

            return (
              <label className={optionClassName(selected, disabled)} key={category.key}>
                <input
                  checked={selected}
                  className="sr-only"
                  disabled={disabled}
                  name="category"
                  onChange={() => onCategoryChange(category.key)}
                  type="radio"
                  value={category.key}
                />
                {category.name}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset aria-describedby="tag-selection-help">
        <legend className="sr-only">标签</legend>
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm font-medium text-foreground">标签</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            {tagKeys.length} / {MAX_PROMPT_TAGS}
          </span>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground" id="tag-selection-help">
          至少选择 1 个；用风格、形式和主题帮助用户继续发现相似作品。
        </p>
        <div className="mt-4 space-y-4">
          {tagKinds.map((kind) => {
            const group = tags.filter((tag) => tag.kind === kind);

            return (
              <div className="grid gap-2 sm:grid-cols-[3rem_1fr]" key={kind}>
                <p className="pt-2.5 text-xs text-muted-foreground">
                  {TAG_KIND_LABELS[kind]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.map((tag) => {
                    const selected = tagKeys.includes(tag.key);
                    const unavailable =
                      disabled || (!selected && tagKeys.length >= MAX_PROMPT_TAGS);

                    return (
                      <label
                        className={optionClassName(selected, unavailable)}
                        key={tag.key}
                      >
                        <input
                          checked={selected}
                          className="sr-only"
                          disabled={unavailable}
                          onChange={() => toggleTag(tag.key)}
                          type="checkbox"
                          value={tag.key}
                        />
                        {tag.name}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
