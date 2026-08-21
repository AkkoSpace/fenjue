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
import type {
  PromptCardData,
  PromptEntryData,
  PromptImage,
} from "@/lib/content/types";
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
  published_at: string;
  slug: string;
  source_url: string;
  title: string;
}

interface PromptCardRow {
  is_nsfw: boolean;
  prompt_images: PromptImageRow[];
  slug: string;
  title: string;
}

interface PromptSitemapRow {
  id: string;
  published_at: string;
  slug: string;
}

export interface PromptSitemapEntry {
  lastModified: string;
  slug: string;
}

interface PromptFacetOption {
  count: number;
  key: string;
  name: string;
  sortOrder: number;
}

interface PromptFacets {
  categories: PromptFacetOption[];
  categoryAllCount: number;
  filteredCount: number;
  tagAllCount: number;
  tags: PromptFacetOption[];
}

export interface PromptPageData extends PromptFacets {
  activeCategory?: string;
  activeTag?: string;
  entries: PromptCardData[];
  page: number;
  pageSize: number;
  totalPages: number;
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

function promptFromRow(row: PromptRow, r2BaseUrl: string): PromptEntryData {
  return {
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
    publishedAt: row.published_at,
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
  };
}

function promptCardFromRow(
  row: PromptCardRow,
  r2BaseUrl: string,
): PromptCardData {
  return {
    images: [...row.prompt_images]
      .sort((a, b) => a.position - b.position)
      .map((image) => r2Image(r2BaseUrl, image.object_key, image)),
    isNsfw: row.is_nsfw,
    slug: row.slug,
    title: row.title,
  };
}

const PROMPT_SELECT =
  "slug,title,prompt,author_name,author_url,source_url,is_nsfw,content_relation,published_at,category:categories!prompts_category_key_fkey(key,name,sort_order),prompt_images(position,object_key,alt,width,height),prompt_ai_tools(tool_key),prompt_tags(tag:tags(key,name,kind,sort_order))";
const PROMPT_CARD_SELECT =
  "slug,title,is_nsfw,prompt_images(position,object_key,alt,width,height)";

export const PROMPT_PAGE_SIZE = 24;
const SITEMAP_BATCH_SIZE = 1_000;

function positivePage(value: number) {
  return Number.isSafeInteger(value) && value > 0 ? Math.min(value, 9999) : 1;
}

function isFacetOption(value: unknown): value is PromptFacetOption {
  if (!value || typeof value !== "object") return false;
  const option = value as Record<string, unknown>;
  return (
    typeof option.key === "string" &&
    typeof option.name === "string" &&
    Number.isSafeInteger(option.count) &&
    Number.isSafeInteger(option.sortOrder)
  );
}

function normalizeFacets(value: unknown): PromptFacets {
  if (!value || typeof value !== "object") {
    throw new Error("Prompt facets are missing");
  }

  const facets = value as Record<string, unknown>;
  const categories = Array.isArray(facets.categories)
    ? facets.categories.filter(isFacetOption)
    : [];
  const tags = Array.isArray(facets.tags)
    ? facets.tags.filter(isFacetOption)
    : [];

  return {
    categories,
    categoryAllCount:
      typeof facets.categoryAllCount === "number"
        ? facets.categoryAllCount
        : 0,
    filteredCount:
      typeof facets.filteredCount === "number" ? facets.filteredCount : 0,
    tagAllCount:
      typeof facets.tagAllCount === "number" ? facets.tagAllCount : 0,
    tags,
  };
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

export async function getPromptPage({
  categoryKey,
  page: requestedPage,
  tagKey,
}: {
  categoryKey?: string;
  page: number;
  tagKey?: string;
}): Promise<PromptPageData> {
  "use cache";
  cacheLife("minutes");
  cacheTag("prompts");

  const r2BaseUrl = getR2PublicBaseUrl();
  const supabase = publicContentClient();
  const taxonomy = await getContentTaxonomy();
  const activeCategory = taxonomy.categories.some(
    (category) => category.key === categoryKey,
  )
    ? categoryKey
    : undefined;
  const activeTag = taxonomy.tags.some((tag) => tag.key === tagKey)
    ? tagKey
    : undefined;
  const page = positivePage(requestedPage);
  const from = (page - 1) * PROMPT_PAGE_SIZE;
  let listQuery = supabase
    .from("prompts")
    .select(
      activeTag
        ? `${PROMPT_CARD_SELECT},selected_tag:prompt_tags!inner(tag_key)`
        : PROMPT_CARD_SELECT,
    )
    .eq("published", true)
    .eq("review_status", "approved")
    .order("published_at", { ascending: false })
    .range(from, from + PROMPT_PAGE_SIZE - 1);

  if (activeCategory) {
    listQuery = listQuery.eq("category_key", activeCategory);
  }

  if (activeTag) {
    listQuery = listQuery.eq("selected_tag.tag_key", activeTag);
  }

  const [listResult, facetResult] = await Promise.all([
    listQuery,
    supabase.rpc("get_prompt_facets", {
      p_category_key: activeCategory ?? null,
      p_tag_key: activeTag ?? null,
    }),
  ]);
  const error = listResult.error ?? facetResult.error;

  if (error) {
    console.error("Unable to load published prompts from Supabase", error);
    throw new Error("Unable to load published prompts from Supabase");
  }

  const facets = normalizeFacets(facetResult.data);
  const total = facets.filteredCount;

  return {
    ...facets,
    activeCategory,
    activeTag,
    entries: ((listResult.data ?? []) as unknown as PromptCardRow[]).map(
      (row) => promptCardFromRow(row, r2BaseUrl),
    ),
    page,
    pageSize: PROMPT_PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PROMPT_PAGE_SIZE)),
  };
}

export async function getPromptSitemapEntries(): Promise<
  PromptSitemapEntry[]
> {
  "use cache";
  cacheLife("hours");
  cacheTag("prompts");

  const supabase = publicContentClient();
  const countResult = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("published", true)
    .eq("review_status", "approved");

  if (countResult.error) {
    console.error("Unable to count prompts for sitemap", countResult.error);
    throw new Error("Unable to count prompts for sitemap");
  }

  const count = countResult.count ?? 0;
  const batchCount = Math.ceil(count / SITEMAP_BATCH_SIZE);
  const batchResults = await Promise.all(
    Array.from({ length: batchCount }, (_, index) => {
      const from = index * SITEMAP_BATCH_SIZE;

      return supabase
        .from("prompts")
        .select("id,slug,published_at")
        .eq("published", true)
        .eq("review_status", "approved")
        .order("id", { ascending: true })
        .range(from, from + SITEMAP_BATCH_SIZE - 1);
    }),
  );
  const error = batchResults.find((result) => result.error)?.error;

  if (error) {
    console.error("Unable to load prompts for sitemap", error);
    throw new Error("Unable to load prompts for sitemap");
  }

  return batchResults
    .flatMap((result) => (result.data ?? []) as PromptSitemapRow[])
    .map((row) => ({
      lastModified: row.published_at,
      slug: row.slug,
    }));
}

export async function getPromptBySlug(
  slug: string,
): Promise<PromptEntryData | undefined> {
  "use cache";
  cacheLife("minutes");
  cacheTag("prompts");

  const r2BaseUrl = getR2PublicBaseUrl();
  const supabase = publicContentClient();
  const { data, error } = await supabase
    .from("prompts")
    .select(PROMPT_SELECT)
    .eq("published", true)
    .eq("review_status", "approved")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Unable to load prompt from Supabase", error);
    throw new Error("Unable to load prompt from Supabase");
  }

  return data
    ? promptFromRow(data as unknown as PromptRow, r2BaseUrl)
    : undefined;
}
