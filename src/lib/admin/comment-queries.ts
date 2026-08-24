import "server-only";

import { requireAdmin } from "@/lib/auth/authorization";
import {
  aiToolFromRelation,
  type AiTool,
  type AiToolRow,
} from "@/lib/content/ai-tools";
import type { PromptReviewStatus } from "@/lib/content/review";

const PAGE_SIZE = 20;

export type AdminCommentStatus = "all" | PromptReviewStatus;

export interface AdminPromptComment {
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  promptSlug: string;
  promptTitle: string;
  reviewNote: string | null;
  reviewStatus: PromptReviewStatus;
  tool: AiTool | null;
}
function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function status(value: string | undefined): AdminCommentStatus {
  return value === "pending" || value === "approved" || value === "rejected"
    ? value
    : "all";
}

function page(value: string | undefined) {
  const parsed = Number.parseInt(value ?? "1", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? Math.min(parsed, 9999) : 1;
}

export async function getAdminPromptComments(raw: {
  page?: string | string[];
  status?: string | string[];
}) {
  const { supabase } = await requireAdmin();
  const activeStatus = status(first(raw.status));
  const activePage = page(first(raw.page));
  const from = (activePage - 1) * PAGE_SIZE;
  let query = supabase
    .from("prompt_comments")
    .select(
      "id,author_name,body,tool:ai_tools!prompt_comments_tool_key_fkey(key,name,description,logo_url,website_url,active,sort_order),review_status,review_note,created_at,prompt:prompts!inner(slug,title)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (activeStatus !== "all") query = query.eq("review_status", activeStatus);
  const { data, error, count } = await query;

  if (error) {
    console.warn("Unable to load admin comments", error.code);
    throw new Error("评价列表加载失败，请稍后重试。");
  }

  const comments = (data ?? []).flatMap((value) => {
    const row = value as unknown as {
      author_name: string;
      body: string;
      created_at: string;
      id: string;
      prompt: { slug: string; title: string } | { slug: string; title: string }[];
      review_note: string | null;
      review_status: PromptReviewStatus;
      tool: AiToolRow | AiToolRow[] | null;
    };
    const prompt = Array.isArray(row.prompt) ? row.prompt[0] : row.prompt;
    return prompt
      ? [{
          authorName: row.author_name,
          body: row.body,
          createdAt: row.created_at,
          id: row.id,
          promptSlug: prompt.slug,
          promptTitle: prompt.title,
          reviewNote: row.review_note,
          reviewStatus: row.review_status,
          tool: aiToolFromRelation(row.tool),
        } satisfies AdminPromptComment]
      : [];
  });

  return {
    comments,
    page: activePage,
    pageSize: PAGE_SIZE,
    status: activeStatus,
    total: count ?? 0,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE)),
  };
}
