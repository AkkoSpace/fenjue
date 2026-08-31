export type SourcePlatformKey = string;

export interface SourcePlatform {
  active: boolean;
  brandColor: string | null;
  key: SourcePlatformKey;
  logoUrl: string | null;
  name: string;
  sortOrder: number;
  websiteUrl: string | null;
}

export interface SourcePlatformRow {
  active: boolean;
  brand_color: string | null;
  key: string;
  logo_url: string | null;
  name: string;
  sort_order: number;
  website_url: string | null;
}

const SOURCE_PLATFORM_KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSourcePlatformKey(value: unknown): value is SourcePlatformKey {
  return (
    typeof value === "string" &&
    value.length <= 64 &&
    SOURCE_PLATFORM_KEY_PATTERN.test(value)
  );
}

export function sourcePlatformFromRow(row: SourcePlatformRow): SourcePlatform {
  return {
    active: row.active,
    brandColor: row.brand_color,
    key: row.key,
    logoUrl: row.logo_url,
    name: row.name,
    sortOrder: row.sort_order,
    websiteUrl: row.website_url,
  };
}

export function sourcePlatformFromRelation(
  relation: SourcePlatformRow | SourcePlatformRow[] | null,
): SourcePlatform | null {
  const row = Array.isArray(relation) ? relation[0] : relation;
  return row ? sourcePlatformFromRow(row) : null;
}

export function sortSourcePlatforms<T extends SourcePlatform>(platforms: T[]): T[] {
  return [...platforms].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder ||
      left.name.localeCompare(right.name, "zh-CN"),
  );
}
