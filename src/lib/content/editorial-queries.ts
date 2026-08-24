import "server-only";

import { createClient as createPublicClient } from "@supabase/supabase-js";
import { cacheLife, cacheTag } from "next/cache";

import {
  aiToolFromRelation,
  type AiToolRow,
} from "@/lib/content/ai-tools";
import type {
  FeaturedPrompt,
  PromptCollectionDetail,
  PromptCollectionSummary,
  PromptComment,
} from "@/lib/content/editorial";
import type { PromptReviewStatus } from "@/lib/content/review";
import type { PromptCardData, PromptImage } from "@/lib/content/types";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

interface ImageRow {
  alt: string;
  height: number;
  object_key: string;
  position: number;
  width: number;
}

interface CardRow {
  is_nsfw: boolean;
  prompt_images: ImageRow[];
  slug: string;
  title: string;
}

interface CollectionPromptRow {
  position: number;
  prompt: CardRow | CardRow[];
}

interface CollectionRow {
  collection_prompts: CollectionPromptRow[];
  description: string;
  id: string;
  slug: string;
  sort_order: number;
  title: string;
  updated_at: string;
}

interface CommentRow {
  author_name: string;
  body: string;
  created_at: string;
  id: string;
  review_note: string | null;
  review_status: PromptReviewStatus;
  tool: AiToolRow | AiToolRow[] | null;
}

const CARD_SELECT =
  "slug,title,is_nsfw,prompt_images(position,object_key,alt,width,height)";

function anonymousClient() {
  const { publishableKey, url } = getSupabasePublicConfig();
  return createPublicClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function r2BaseUrl() {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("R2 public configuration is missing");
  return baseUrl;
}

function imageFromRow(row: ImageRow, baseUrl: string): PromptImage {
  return {
    alt: row.alt,
    height: row.height,
    objectKey: row.object_key,
    src: `${baseUrl}/${row.object_key}`,
    width: row.width,
  };
}

function cardFromRow(row: CardRow, baseUrl: string): PromptCardData {
  return {
    images: [...row.prompt_images]
      .sort((left, right) => left.position - right.position)
      .map((image) => imageFromRow(image, baseUrl)),
    isNsfw: row.is_nsfw,
    slug: row.slug,
    title: row.title,
  };
}

function promptFromRelation(relation: CardRow | CardRow[]) {
  return Array.isArray(relation) ? relation[0] : relation;
}

function collectionFromRow(
  row: CollectionRow,
  baseUrl: string,
): PromptCollectionDetail {
  const entries = [...row.collection_prompts]
    .sort((left, right) => left.position - right.position)
    .flatMap((item) => {
      const prompt = promptFromRelation(item.prompt);
      return prompt ? [cardFromRow(prompt, baseUrl)] : [];
    });

  return {
    cover: entries.find((entry) => !entry.isNsfw)?.images[0],
    description: row.description,
    entries,
    id: row.id,
    promptCount: entries.length,
    slug: row.slug,
    sortOrder: row.sort_order,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

function commentFromRow(row: CommentRow, isOwn: boolean): PromptComment {
  return {
    authorName: row.author_name,
    body: row.body,
    createdAt: row.created_at,
    id: row.id,
    isOwn,
    reviewNote: row.review_note,
    reviewStatus: row.review_status,
    tool: aiToolFromRelation(row.tool),
  };
}

export async function getFeaturedPrompts(): Promise<FeaturedPrompt[]> {
  "use cache";
  cacheLife("minutes");
  cacheTag("editorial");
  cacheTag("prompts");

  const baseUrl = r2BaseUrl();
  const { data, error } = await anonymousClient()
    .from("prompt_features")
    .select(`recommendation,position,prompt:prompts!inner(${CARD_SELECT})`)
    .order("position")
    .order("featured_at", { ascending: false })
    .limit(6);

  if (error) {
    console.error("Unable to load featured prompts", error.code);
    throw new Error("Unable to load featured prompts");
  }

  return (data ?? []).flatMap((value) => {
    const row = value as unknown as {
      position: number;
      prompt: CardRow | CardRow[];
      recommendation: string;
    };
    const prompt = promptFromRelation(row.prompt);
    return prompt
      ? [{
          entry: cardFromRow(prompt, baseUrl),
          position: row.position,
          recommendation: row.recommendation,
        }]
      : [];
  });
}

export async function getPublishedCollections(): Promise<
  PromptCollectionSummary[]
> {
  "use cache";
  cacheLife("minutes");
  cacheTag("editorial");
  cacheTag("prompts");

  const baseUrl = r2BaseUrl();
  const { data, error } = await anonymousClient()
    .from("collections")
    .select(
      `id,slug,title,description,sort_order,updated_at,collection_prompts(position,prompt:prompts!inner(${CARD_SELECT}))`,
    )
    .eq("published", true)
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Unable to load published collections", error.code);
    throw new Error("Unable to load published collections");
  }

  return ((data ?? []) as unknown as CollectionRow[]).map((row) => {
    const collection = collectionFromRow(row, baseUrl);
    return {
      cover: collection.cover,
      description: collection.description,
      id: collection.id,
      promptCount: collection.promptCount,
      slug: collection.slug,
      sortOrder: collection.sortOrder,
      title: collection.title,
      updatedAt: collection.updatedAt,
    };
  });
}

export async function getPublishedCollectionBySlug(
  slug: string,
): Promise<PromptCollectionDetail | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("editorial");
  cacheTag("prompts");

  const baseUrl = r2BaseUrl();
  const { data, error } = await anonymousClient()
    .from("collections")
    .select(
      `id,slug,title,description,sort_order,updated_at,collection_prompts(position,prompt:prompts!inner(${CARD_SELECT}))`,
    )
    .eq("published", true)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Unable to load published collection", error.code);
    throw new Error("Unable to load published collection");
  }

  return data
    ? collectionFromRow(data as unknown as CollectionRow, baseUrl)
    : undefined;
}

export async function getPublishedPromptComments(
  slug: string,
): Promise<{ comments: PromptComment[]; total: number }> {
  "use cache";
  cacheLife("minutes");
  cacheTag("ai-tools");
  cacheTag(`comments:${slug}`);

  const { count, data, error } = await anonymousClient()
    .from("prompt_comments")
    .select(
      "id,author_name,body,tool:ai_tools!prompt_comments_tool_key_fkey(key,name,description,logo_url,website_url,active,sort_order),review_status,review_note,created_at,prompt:prompts!inner(slug)",
      { count: "exact" },
    )
    .eq("prompt.slug", slug)
    .eq("review_status", "approved")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Unable to load published comments", error.code);
    throw new Error("Unable to load published comments");
  }

  return {
    comments: ((data ?? []) as unknown as CommentRow[]).map((row) =>
      commentFromRow(row, false),
    ),
    total: count ?? 0,
  };
}

export async function getOwnPromptComments(
  slug: string,
): Promise<{ comments: PromptComment[]; isAuthenticated: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { comments: [], isAuthenticated: false };

  const { data, error } = await supabase
    .from("prompt_comments")
    .select(
      "id,author_name,body,tool:ai_tools!prompt_comments_tool_key_fkey(key,name,description,logo_url,website_url,active,sort_order),review_status,review_note,created_at,prompt:prompts!inner(slug)",
    )
    .eq("user_id", user.id)
    .eq("prompt.slug", slug)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.warn("Unable to load own comments", error.code);
    return { comments: [], isAuthenticated: true };
  }

  return {
    comments: ((data ?? []) as unknown as CommentRow[]).map((row) =>
      commentFromRow(row, true),
    ),
    isAuthenticated: true,
  };
}
