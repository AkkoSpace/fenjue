export const MAX_VERIFIED_AI_TOOLS = 4;

export type AiToolKey = string;

export interface AiTool {
  active: boolean;
  brandColor: string | null;
  description: string;
  key: AiToolKey;
  logoUrl: string | null;
  name: string;
  sortOrder: number;
  websiteUrl: string | null;
}

export interface AiToolRow {
  active: boolean;
  brand_color: string | null;
  description: string;
  key: string;
  logo_url: string | null;
  name: string;
  sort_order: number;
  website_url: string | null;
}

const AI_TOOL_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isAiToolKey(value: unknown): value is AiToolKey {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    AI_TOOL_KEY_PATTERN.test(value)
  );
}

export function normalizeAiToolKeys(value: unknown): AiToolKey[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.filter(isAiToolKey))];
}

export function aiToolFromRow(row: AiToolRow): AiTool {
  return {
    active: row.active,
    brandColor: row.brand_color,
    description: row.description,
    key: row.key,
    logoUrl: row.logo_url,
    name: row.name,
    sortOrder: row.sort_order,
    websiteUrl: row.website_url,
  };
}

export function aiToolFromRelation(
  relation: AiToolRow | AiToolRow[] | null,
): AiTool | null {
  const row = Array.isArray(relation) ? relation[0] : relation;
  return row ? aiToolFromRow(row) : null;
}

export function sortAiTools(tools: AiTool[]) {
  return [...tools].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.name.localeCompare(right.name, "zh-CN"),
  );
}
