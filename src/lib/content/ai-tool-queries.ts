import "server-only";

import { createClient as createPublicClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

import {
  aiToolFromRow,
  sortAiTools,
  type AiTool,
  type AiToolRow,
} from "@/lib/content/ai-tools";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const AI_TOOL_SELECT =
  "key,name,description,logo_url,website_url,active,sort_order";

function publicClient() {
  const { publishableKey, url } = getSupabasePublicConfig();
  return createPublicClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

export async function getActiveAiTools(): Promise<AiTool[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("ai-tools");

  const { data, error } = await publicClient()
    .from("ai_tools")
    .select(AI_TOOL_SELECT)
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("Unable to load active AI tools", error.code);
    throw new Error("Unable to load active AI tools");
  }

  return sortAiTools(((data ?? []) as AiToolRow[]).map(aiToolFromRow));
}
