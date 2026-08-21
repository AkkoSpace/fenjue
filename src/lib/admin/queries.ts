import "server-only";

import { requireAdmin } from "@/lib/auth/authorization";
import {
  normalizeAiToolKeys,
  type AiToolKey,
} from "@/lib/content/ai-tools";
import type { ContentRelation } from "@/lib/content/relation";
import type {
  TaxonomyCategory,
  TaxonomyTag,
  TaxonomyTagKind,
} from "@/lib/content/taxonomy";

const PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 80;

export type AdminPromptStatus = "all" | "hidden" | "published";
export type PromptImportStatus = "missing_media" | "needs_review" | "ready";

interface PromptImageRow {
  alt: string;
  height: number;
  object_key: string;
  position: number;
  width: number;
}

interface PromptAdminRow {
  author_name: string;
  category: {
    key: string;
    name: string;
    sort_order: number;
  } | {
    key: string;
    name: string;
    sort_order: number;
  }[];
  content_relation: ContentRelation;
  created_at: string;
  id: string;
  import_note: string | null;
  import_status: PromptImportStatus | null;
  is_nsfw: boolean;
  prompt_images: PromptImageRow[];
  prompt_ai_tools: { tool_key: AiToolKey }[];
  prompt_tags: {
    tag: {
      key: string;
      kind: TaxonomyTagKind;
      name: string;
      sort_order: number;
    } | {
      key: string;
      kind: TaxonomyTagKind;
      name: string;
      sort_order: number;
    }[];
  }[];
  published: boolean;
  published_at: string | null;
  slug: string;
  source_url: string;
  title: string;
}

export interface AdminPromptListItem {
  authorName: string;
  category: TaxonomyCategory;
  cover?: {
    alt: string;
    height: number;
    src: string;
    width: number;
  };
  createdAt: string;
  contentRelation: ContentRelation;
  id: string;
  imageCount: number;
  importNote: string | null;
  importStatus: PromptImportStatus | null;
  isNsfw: boolean;
  published: boolean;
  publishedAt: string | null;
  slug: string;
  sourceUrl: string;
  tags: TaxonomyTag[];
  title: string;
  verifiedTools: AiToolKey[];
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanSearch(value: string | undefined) {
  return (value ?? "")
    .replace(/[^\p{L}\p{N}\s@_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH_LENGTH);
}

function parsePage(value: string | undefined) {
  const page = Number.parseInt(value ?? "1", 10);
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, 9999) : 1;
}

function parseStatus(value: string | undefined): AdminPromptStatus {
  return value === "published" || value === "hidden" ? value : "all";
}

function publicImageUrl(objectKey: string) {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/${objectKey}` : undefined;
}

export interface AdminPromptSearchParams {
  page?: string | string[];
  q?: string | string[];
  status?: string | string[];
}

export async function getAdminPrompts(raw: AdminPromptSearchParams) {
  const { profile, supabase } = await requireAdmin();
  const page = parsePage(first(raw.page));
  const query = cleanSearch(first(raw.q));
  const status = parseStatus(first(raw.status));
  const from = (page - 1) * PAGE_SIZE;

  let listQuery = supabase
    .from("prompts")
    .select(
      "id,slug,title,author_name,source_url,is_nsfw,content_relation,import_status,import_note,published,published_at,created_at,category:categories!prompts_category_key_fkey(key,name,sort_order),prompt_images(position,object_key,alt,width,height),prompt_ai_tools(tool_key),prompt_tags(tag:tags(key,name,kind,sort_order))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status !== "all") {
    listQuery = listQuery.eq("published", status === "published");
  }

  if (query) {
    const pattern = `%${query.replaceAll("_", "\\_")}%`;
    listQuery = listQuery.or(
      `title.ilike.${pattern},author_name.ilike.${pattern},slug.ilike.${pattern}`,
    );
  }

  const [listResult, allResult, publishedResult, hiddenResult] =
    await Promise.all([
      listQuery,
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("published", true),
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("published", false),
    ]);

  const error =
    listResult.error ??
    allResult.error ??
    publishedResult.error ??
    hiddenResult.error;

  if (error) {
    console.warn("Unable to load admin prompt list", error.code);
    return {
      counts: { all: 0, hidden: 0, published: 0 },
      error: "作品列表加载失败，请检查管理员权限和数据库迁移。",
      items: [] as AdminPromptListItem[],
      page,
      pageSize: PAGE_SIZE,
      profile,
      query,
      status,
      total: 0,
    };
  }

  const rows = (listResult.data ?? []) as unknown as PromptAdminRow[];
  const items = rows.map((row): AdminPromptListItem => {
    const images = [...row.prompt_images].sort(
      (left, right) => left.position - right.position,
    );
    const firstImage = images[0];
    const src = firstImage ? publicImageUrl(firstImage.object_key) : undefined;

    const category = Array.isArray(row.category)
      ? row.category[0]
      : row.category;

    if (!category) {
      throw new Error("Admin prompt category is missing");
    }

    return {
      authorName: row.author_name,
      category: {
        key: category.key,
        name: category.name,
        sortOrder: category.sort_order,
      },
      cover:
        firstImage && src
          ? {
              alt: firstImage.alt,
              height: firstImage.height,
              src,
              width: firstImage.width,
            }
          : undefined,
      createdAt: row.created_at,
      contentRelation: row.content_relation,
      id: row.id,
      imageCount: images.length,
      importNote: row.import_note,
      importStatus: row.import_status,
      isNsfw: row.is_nsfw,
      published: row.published,
      publishedAt: row.published_at,
      slug: row.slug,
      sourceUrl: row.source_url,
      tags: row.prompt_tags
        .map(({ tag }) => {
          const normalizedTag = Array.isArray(tag) ? tag[0] : tag;

          if (!normalizedTag) {
            throw new Error("Admin prompt tag is missing");
          }

          return {
            key: normalizedTag.key,
            kind: normalizedTag.kind,
            name: normalizedTag.name,
            sortOrder: normalizedTag.sort_order,
          };
        })
        .sort((left, right) => left.sortOrder - right.sortOrder),
      title: row.title,
      verifiedTools: normalizeAiToolKeys(
        row.prompt_ai_tools.map((tool) => tool.tool_key),
      ),
    };
  });

  return {
    counts: {
      all: allResult.count ?? 0,
      hidden: hiddenResult.count ?? 0,
      published: publishedResult.count ?? 0,
    },
    error: undefined,
    items,
    page,
    pageSize: PAGE_SIZE,
    profile,
    query,
    status,
    total: listResult.count ?? 0,
  };
}
