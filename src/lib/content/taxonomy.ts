export const MAX_PROMPT_TAGS = 6;

export type TaxonomyTagKind = "format" | "style" | "theme";

export interface TaxonomyCategory {
  key: string;
  name: string;
  sortOrder: number;
}

export interface TaxonomyTag {
  key: string;
  kind: TaxonomyTagKind;
  name: string;
  sortOrder: number;
}

export interface ContentTaxonomy {
  categories: TaxonomyCategory[];
  tags: TaxonomyTag[];
}

export const TAG_KIND_LABELS: Record<TaxonomyTagKind, string> = {
  style: "风格",
  format: "形式",
  theme: "主题",
};

export function isTaxonomyKey(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

export function normalizeTaxonomyKeys(values: string[]) {
  return [...new Set(values.filter(isTaxonomyKey))];
}
