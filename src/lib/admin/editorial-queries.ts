import "server-only";

import { requireAdmin } from "@/lib/auth/authorization";

export interface AdminCollection {
  createdAt: string;
  description: string;
  id: string;
  promptCount: number;
  published: boolean;
  slug: string;
  sortOrder: number;
  title: string;
  updatedAt: string;
}
export async function getAdminCollections(): Promise<AdminCollection[]> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("collections")
    .select(
      "id,slug,title,description,published,sort_order,created_at,updated_at,collection_prompts(prompt_id)",
    )
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Unable to load admin collections", error.code);
    throw new Error("专栏加载失败，请稍后重试。");
  }

  return (data ?? []).map((row) => ({
    createdAt: row.created_at,
    description: row.description,
    id: row.id,
    promptCount: row.collection_prompts.length,
    published: row.published,
    slug: row.slug,
    sortOrder: row.sort_order,
    title: row.title,
    updatedAt: row.updated_at,
  }));
}
