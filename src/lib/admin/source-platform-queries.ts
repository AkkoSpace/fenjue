import "server-only";

import { requireAdmin } from "@/lib/auth/authorization";
import {
  sortSourcePlatforms,
  sourcePlatformFromRow,
  type SourcePlatform,
  type SourcePlatformRow,
} from "@/lib/content/source-platforms";

export interface AdminSourcePlatform extends SourcePlatform {
  createdAt: string;
  promptUsageCount: number;
  updatedAt: string;
}

interface AdminSourcePlatformRow extends SourcePlatformRow {
  created_at: string;
  prompt_usage_count: number;
  updated_at: string;
}

export async function getAdminSourcePlatforms() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_get_source_platforms");

  if (error) {
    console.warn("Unable to load source platforms", error.code);
    return {
      error: "来源平台目录加载失败，请确认数据库迁移已经执行。",
      items: [] as AdminSourcePlatform[],
    };
  }

  return {
    error: undefined,
    items: sortSourcePlatforms(
      ((data ?? []) as AdminSourcePlatformRow[]).map((row) => ({
        ...sourcePlatformFromRow(row),
        createdAt: row.created_at,
        promptUsageCount: Number(row.prompt_usage_count) || 0,
        updatedAt: row.updated_at,
      })),
    ),
  };
}
