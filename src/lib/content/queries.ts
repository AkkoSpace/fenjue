import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

import type { PromptEntryData, PromptImage } from "@/lib/content/types";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

interface PromptImageRow {
  alt: string;
  height: number;
  object_key: string;
  position: number;
  width: number;
}

interface PromptRow {
  author_name: string;
  author_url: string;
  is_nsfw: boolean;
  prompt: string;
  prompt_images: PromptImageRow[];
  slug: string;
  source_url: string;
  title: string;
}

function r2Image(
  baseUrl: string,
  objectKey: string,
  row: PromptImageRow,
): PromptImage {
  return {
    alt: row.alt,
    height: row.height,
    objectKey,
    src: `${baseUrl}/${objectKey}`,
    width: row.width,
  };
}

function getR2PublicBaseUrl() {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    throw new Error("R2 public configuration is missing");
  }

  return baseUrl;
}

export async function getPrompts(): Promise<PromptEntryData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("prompts");

  const { publishableKey, url } = getSupabasePublicConfig();
  const r2BaseUrl = getR2PublicBaseUrl();
  const supabase = createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase
    .from("prompts")
    .select(
      "slug,title,prompt,author_name,author_url,source_url,is_nsfw,prompt_images(position,object_key,alt,width,height)",
    )
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Unable to load published prompts from Supabase", error);
    throw new Error("Unable to load published prompts from Supabase");
  }

  return ((data ?? []) as PromptRow[]).map((row) => ({
    author: {
      name: row.author_name,
      url: row.author_url,
    },
    images: [...row.prompt_images]
      .sort((a, b) => a.position - b.position)
      .map((image) => r2Image(r2BaseUrl, image.object_key, image)),
    isNsfw: row.is_nsfw,
    prompt: row.prompt,
    slug: row.slug,
    sourceUrl: row.source_url,
    title: row.title,
  }));
}

export async function getPromptBySlug(
  slug: string,
): Promise<PromptEntryData | undefined> {
  const prompts = await getPrompts();

  return prompts.find((prompt) => prompt.slug === slug);
}
