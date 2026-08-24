import "server-only";

import { requireAdmin } from "@/lib/auth/authorization";
import {
  aiToolFromRow,
  type AiTool,
  type AiToolRow,
} from "@/lib/content/ai-tools";

export interface AdminAiTool extends AiTool {
  commentUsageCount: number;
  createdAt: string;
  promptUsageCount: number;
  updatedAt: string;
}

interface AdminAiToolRow extends AiToolRow {
  comment_usage_count: number;
  created_at: string;
  prompt_usage_count: number;
  updated_at: string;
}

export async function getAdminAiTools() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_get_ai_tools");

  if (error) {
    console.warn("Unable to load admin AI tools", error.code);
    return {
      error: "模型目录加载失败，请确认数据库迁移已经执行。",
      items: [] as AdminAiTool[],
    };
  }

  return {
    error: undefined,
    items: ((data ?? []) as AdminAiToolRow[]).map((row) => ({
      ...aiToolFromRow(row),
      commentUsageCount: Number(row.comment_usage_count) || 0,
      createdAt: row.created_at,
      promptUsageCount: Number(row.prompt_usage_count) || 0,
      updatedAt: row.updated_at,
    })),
  };
}
