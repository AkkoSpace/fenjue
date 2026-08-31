import "server-only";

import { createClient as createPublicClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

import {
  sortSourcePlatforms,
  sourcePlatformFromRow,
  type SourcePlatform,
  type SourcePlatformRow,
} from "@/lib/content/source-platforms";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

const SOURCE_PLATFORM_SELECT =
  "key,name,logo_url,brand_color,website_url,active,sort_order";

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

export async function getActiveSourcePlatforms(): Promise<SourcePlatform[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("source-platforms");

  const { data, error } = await publicClient()
    .from("source_platforms")
    .select(SOURCE_PLATFORM_SELECT)
    .eq("active", true)
    .order("sort_order")
    .order("name");

  if (error) {
    console.error("Unable to load active source platforms", error.code);
    throw new Error("Unable to load active source platforms");
  }

  return sortSourcePlatforms(
    ((data ?? []) as SourcePlatformRow[]).map(sourcePlatformFromRow),
  );
}
