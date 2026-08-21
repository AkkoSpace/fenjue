import "server-only";

import { requireAdmin } from "@/lib/auth/authorization";
import {
  normalizeAiToolKeys,
  type AiToolKey,
} from "@/lib/content/ai-tools";
import type { ContentRelation } from "@/lib/content/relation";
import type { PromptReviewStatus } from "@/lib/content/review";
import type {
  TaxonomyCategory,
  TaxonomyTag,
  TaxonomyTagKind,
} from "@/lib/content/taxonomy";

const PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 80;

export type AdminPromptStatus = "all" | PromptReviewStatus;
export type PromptImportStatus = "missing_media" | "needs_review" | "ready";

interface PromptImageRow {
  alt: string;
  height: number;
  id: string;
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
  review_note: string | null;
  review_status: PromptReviewStatus;
  reviewed_at: string | null;
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
  reviewStatus: PromptReviewStatus;
  slug: string;
  sourceUrl: string;
  tags: TaxonomyTag[];
  title: string;
  verifiedTools: AiToolKey[];
}

export interface AdminPromptDetail {
  authorName: string;
  authorUrl: string;
  category: TaxonomyCategory;
  contentRelation: ContentRelation;
  createdAt: string;
  id: string;
  images: {
    alt: string;
    height: number;
    id: string;
    objectKey: string;
    position: number;
    src: string;
    width: number;
  }[];
  isNsfw: boolean;
  prompt: string;
  published: boolean;
  reviewNote: string | null;
  reviewStatus: PromptReviewStatus;
  reviewedAt: string | null;
  slug: string;
  sourceUrl: string;
  tags: TaxonomyTag[];
  title: string;
  userId: string | null;
  verifiedTools: AiToolKey[];
}

export interface AdminUserListItem {
  createdAt: string;
  displayName: string | null;
  email: string;
  emailConfirmedAt: string | null;
  id: string;
  isSuperAdmin: boolean;
  lastSignInAt: string | null;
  role: "admin" | "user";
}

export interface AdminTaxonomyItem {
  active: boolean;
  key: string;
  name: string;
  publishedCount: number;
  sortOrder: number;
  usageCount: number;
}

export interface AdminTaxonomyTag extends AdminTaxonomyItem {
  kind: TaxonomyTagKind;
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
  return value === "pending" || value === "approved" || value === "rejected"
    ? value
    : "all";
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
      "id,slug,title,author_name,source_url,is_nsfw,content_relation,import_status,import_note,published,published_at,review_status,review_note,reviewed_at,created_at,category:categories!prompts_category_key_fkey(key,name,sort_order),prompt_images(id,position,object_key,alt,width,height),prompt_ai_tools(tool_key),prompt_tags(tag:tags(key,name,kind,sort_order))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status !== "all") {
    listQuery = listQuery.eq("review_status", status);
  }

  if (query) {
    const pattern = `%${query.replaceAll("_", "\\_")}%`;
    listQuery = listQuery.or(
      `title.ilike.${pattern},author_name.ilike.${pattern},slug.ilike.${pattern}`,
    );
  }

  const [listResult, allResult, pendingResult, approvedResult, rejectedResult] =
    await Promise.all([
      listQuery,
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "pending"),
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "approved"),
      supabase
        .from("prompts")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "rejected"),
    ]);

  const error =
    listResult.error ??
    allResult.error ??
    pendingResult.error ??
    approvedResult.error ??
    rejectedResult.error;

  if (error) {
    console.warn("Unable to load admin prompt list", error.code);
    return {
      counts: { all: 0, approved: 0, pending: 0, rejected: 0 },
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
      reviewStatus: row.review_status,
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
      approved: approvedResult.count ?? 0,
      pending: pendingResult.count ?? 0,
      rejected: rejectedResult.count ?? 0,
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

export async function getAdminPrompt(id: string) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("prompts")
    .select(
      "id,user_id,slug,title,prompt,author_name,author_url,source_url,is_nsfw,content_relation,published,published_at,review_status,review_note,reviewed_at,created_at,category:categories!prompts_category_key_fkey(key,name,sort_order),prompt_images(id,position,object_key,alt,width,height),prompt_ai_tools(tool_key),prompt_tags(tag:tags(key,name,kind,sort_order))",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.warn("Unable to load admin prompt", error.code);
    throw new Error("作品加载失败，请稍后重试。");
  }

  if (!data) return null;

  const row = data as unknown as PromptAdminRow & {
    author_url: string;
    prompt: string;
    user_id: string | null;
  };
  const category = Array.isArray(row.category)
    ? row.category[0]
    : row.category;

  if (!category) {
    throw new Error("作品缺少有效分类，请先检查分类数据。");
  }

  const r2BaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (!r2BaseUrl) {
    throw new Error("R2 公开地址尚未配置。");
  }

  return {
    authorName: row.author_name,
    authorUrl: row.author_url,
    category: {
      key: category.key,
      name: category.name,
      sortOrder: category.sort_order,
    },
    contentRelation: row.content_relation,
    createdAt: row.created_at,
    id: row.id,
    images: [...row.prompt_images]
      .sort((left, right) => left.position - right.position)
      .map((image) => ({
        alt: image.alt,
        height: image.height,
        id: image.id,
        objectKey: image.object_key,
        position: image.position,
        src: `${r2BaseUrl}/${image.object_key}`,
        width: image.width,
      })),
    isNsfw: row.is_nsfw,
    prompt: row.prompt,
    published: row.published,
    reviewNote: row.review_note,
    reviewStatus: row.review_status,
    reviewedAt: row.reviewed_at,
    slug: row.slug,
    sourceUrl: row.source_url,
    tags: row.prompt_tags
      .map(({ tag }) => {
        const normalized = Array.isArray(tag) ? tag[0] : tag;
        if (!normalized) throw new Error("作品标签数据无效。");
        return {
          key: normalized.key,
          kind: normalized.kind,
          name: normalized.name,
          sortOrder: normalized.sort_order,
        };
      })
      .sort((left, right) => left.sortOrder - right.sortOrder),
    title: row.title,
    userId: row.user_id,
    verifiedTools: normalizeAiToolKeys(
      row.prompt_ai_tools.map((tool) => tool.tool_key),
    ),
  } satisfies AdminPromptDetail;
}

export async function getAdminOverview() {
  const content = await getAdminPrompts({});
  const { supabase } = await requireAdmin();
  const [users, categories, tags] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("key", { count: "exact", head: true }),
    supabase.from("tags").select("key", { count: "exact", head: true }),
  ]);

  const error = users.error ?? categories.error ?? tags.error;
  if (error) {
    console.warn("Unable to load admin overview", error.code);
  }

  return {
    content,
    counts: {
      categories: categories.count ?? 0,
      tags: tags.count ?? 0,
      users: users.count ?? 0,
    },
    recent: content.items.slice(0, 5),
  };
}

export interface AdminUserSearchParams {
  page?: string | string[];
  q?: string | string[];
}

export async function getAdminUsers(raw: AdminUserSearchParams) {
  const { profile, supabase } = await requireAdmin();
  const page = parsePage(first(raw.page));
  const query = cleanSearch(first(raw.q));
  const from = (page - 1) * PAGE_SIZE;
  const { data, error } = await supabase.rpc("admin_list_users", {
    p_limit: PAGE_SIZE,
    p_offset: from,
    p_search: query || null,
  });

  if (error) {
    console.warn("Unable to load admin users", error.code);
    return {
      error: "用户列表加载失败，请确认后台管理迁移已经执行。",
      items: [] as AdminUserListItem[],
      page,
      pageSize: PAGE_SIZE,
      profile,
      query,
      total: 0,
    };
  }

  const rows = (data ?? []) as {
    created_at: string;
    display_name: string | null;
    email: string;
    email_confirmed_at: string | null;
    id: string;
    is_super_admin: boolean;
    last_sign_in_at: string | null;
    role: "admin" | "user";
    total_count: number;
  }[];

  return {
    error: undefined,
    items: rows.map((row) => ({
      createdAt: row.created_at,
      displayName: row.display_name,
      email: row.email,
      emailConfirmedAt: row.email_confirmed_at,
      id: row.id,
      isSuperAdmin: row.is_super_admin,
      lastSignInAt: row.last_sign_in_at,
      role: row.role,
    })),
    page,
    pageSize: PAGE_SIZE,
    profile,
    query,
    total: Number(rows[0]?.total_count ?? 0),
  };
}

export async function getAdminTaxonomy() {
  const { profile, supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_get_taxonomy");

  if (error) {
    console.warn("Unable to load admin taxonomy", error.code);
    return {
      categories: [] as AdminTaxonomyItem[],
      error: "分类数据加载失败，请确认后台管理迁移已经执行。",
      profile,
      tags: [] as AdminTaxonomyTag[],
    };
  }

  const result = (data ?? {}) as {
    categories?: AdminTaxonomyItem[];
    tags?: AdminTaxonomyTag[];
  };

  return {
    categories: result.categories ?? [],
    error: undefined,
    profile,
    tags: result.tags ?? [],
  };
}
