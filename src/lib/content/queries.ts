import "server-only";

import { createClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

import {
  normalizeAiToolKeys,
  type AiToolKey,
} from "@/lib/content/ai-tools";
import type { ContentRelation } from "@/lib/content/relation";
import type {
  ContentTaxonomy,
  TaxonomyCategory,
  TaxonomyTag,
  TaxonomyTagKind,
} from "@/lib/content/taxonomy";
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
  category: CategoryRow | CategoryRow[];
  content_relation: ContentRelation;
  is_nsfw: boolean;
  prompt: string;
  prompt_images: PromptImageRow[];
  prompt_ai_tools: { tool_key: AiToolKey }[];
  prompt_tags: {
    tag: TagRow | TagRow[];
  }[];
  slug: string;
  source_url: string;
  title: string;
}

interface CategoryRow {
  key: string;
  name: string;
  sort_order: number;
}

interface TagRow extends CategoryRow {
  kind: TaxonomyTagKind;
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

function publicContentClient() {
  const { publishableKey, url } = getSupabasePublicConfig();

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function categoryFromRow(row: CategoryRow): TaxonomyCategory {
  return { key: row.key, name: row.name, sortOrder: row.sort_order };
}

function categoryFromRelation(relation: CategoryRow | CategoryRow[]) {
  const row = Array.isArray(relation) ? relation[0] : relation;

  if (!row) {
    throw new Error("Published prompt category is missing");
  }

  return categoryFromRow(row);
}

function tagFromRow(row: TagRow): TaxonomyTag {
  return {
    key: row.key,
    kind: row.kind,
    name: row.name,
    sortOrder: row.sort_order,
  };
}

function tagFromRelation(relation: TagRow | TagRow[]) {
  const row = Array.isArray(relation) ? relation[0] : relation;

  if (!row) {
    throw new Error("Published prompt tag is missing");
  }

  return tagFromRow(row);
}

export async function getContentTaxonomy(): Promise<ContentTaxonomy> {
  "use cache";
  cacheLife("hours");
  cacheTag("taxonomy");

  const supabase = publicContentClient();
  const [categoryResult, tagResult] = await Promise.all([
    supabase
      .from("categories")
      .select("key,name,sort_order")
      .order("sort_order"),
    supabase
      .from("tags")
      .select("key,name,kind,sort_order")
      .order("sort_order"),
  ]);
  const error = categoryResult.error ?? tagResult.error;

  if (error) {
    console.error("Unable to load content taxonomy from Supabase", error);
    throw new Error("Unable to load content taxonomy from Supabase");
  }

  const categories = ((categoryResult.data ?? []) as CategoryRow[]).map(
    categoryFromRow,
  );
  const tags = ((tagResult.data ?? []) as TagRow[]).map(tagFromRow);

  if (!categories.length || !tags.length) {
    throw new Error("Content taxonomy is empty");
  }

  return { categories, tags };
}

export async function getPrompts(): Promise<PromptEntryData[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("prompts");

  const r2BaseUrl = getR2PublicBaseUrl();
  const supabase = publicContentClient();

  const { data, error } = await supabase
    .from("prompts")
    .select(
      "slug,title,prompt,author_name,author_url,source_url,is_nsfw,content_relation,category:categories!prompts_category_key_fkey(key,name,sort_order),prompt_images(position,object_key,alt,width,height),prompt_ai_tools(tool_key),prompt_tags(tag:tags(key,name,kind,sort_order))",
    )
    .eq("published", true)
    .order("published_at", { ascending: false });

  if (error) {
    console.error("Unable to load published prompts from Supabase", error);
    throw new Error("Unable to load published prompts from Supabase");
  }

  return ((data ?? []) as unknown as PromptRow[]).map((row) => ({
    author: {
      name: row.author_name,
      url: row.author_url,
    },
    category: categoryFromRelation(row.category),
    contentRelation: row.content_relation,
    images: [...row.prompt_images]
      .sort((a, b) => a.position - b.position)
      .map((image) => r2Image(r2BaseUrl, image.object_key, image)),
    isNsfw: row.is_nsfw,
    prompt: row.prompt,
    slug: row.slug,
    sourceUrl: row.source_url,
    tags: row.prompt_tags
      .map(({ tag }) => tagFromRelation(tag))
      .sort((left, right) => left.sortOrder - right.sortOrder),
    title: row.title,
    verifiedTools: normalizeAiToolKeys(
      row.prompt_ai_tools.map((tool) => tool.tool_key),
    ),
  }));
}

export async function getPromptBySlug(
  slug: string,
): Promise<PromptEntryData | undefined> {
  const prompts = await getPrompts();

  return prompts.find((prompt) => prompt.slug === slug);
}
