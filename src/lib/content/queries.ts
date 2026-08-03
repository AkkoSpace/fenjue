import "server-only";

import { createClient } from "@supabase/supabase-js";

import { seedPrompts } from "@/content/prompts";
import type { PromptEntryData, PromptImage } from "@/lib/content/types";
import {
  getSupabasePublicConfig,
  hasSupabasePublicConfig,
} from "@/lib/supabase/config";

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
  prompt: string;
  prompt_images: PromptImageRow[];
  slug: string;
  source_url: string;
  title: string;
}

function r2Image(objectKey: string, row: PromptImageRow): PromptImage {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");

  return {
    alt: row.alt,
    height: row.height,
    objectKey,
    src: baseUrl ? `${baseUrl}/${objectKey}` : undefined,
    width: row.width,
  };
}

function hasRemoteContentConfig() {
  return Boolean(hasSupabasePublicConfig() && process.env.R2_PUBLIC_BASE_URL);
}

export async function getPrompts(): Promise<PromptEntryData[]> {
  if (!hasRemoteContentConfig()) {
    return seedPrompts;
  }

  const { publishableKey, url } = getSupabasePublicConfig();
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
      "slug,title,prompt,author_name,author_url,source_url,prompt_images(position,object_key,alt,width,height)",
    )
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error || !data?.length) {
    console.warn("Unable to load published prompts from Supabase", error);
    return seedPrompts;
  }

  return (data as PromptRow[]).map((row) => ({
    author: {
      name: row.author_name,
      url: row.author_url,
    },
    images: [...row.prompt_images]
      .sort((a, b) => a.position - b.position)
      .map((image) => r2Image(image.object_key, image)),
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
