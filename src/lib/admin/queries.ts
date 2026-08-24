import "server-only";

import { getAdminAnalyticsStorageOverview } from "@/lib/admin/analytics-queries";
import { requireAdmin } from "@/lib/auth/authorization";
import {
  aiToolFromRelation,
  sortAiTools,
  type AiTool,
  type AiToolRow,
} from "@/lib/content/ai-tools";
import type { ContentRelation } from "@/lib/content/relation";
import type { PromptReviewStatus } from "@/lib/content/review";
import type {
  TaxonomyCategory,
  TaxonomyTag,
  TaxonomyTagKind,
} from "@/lib/content/taxonomy";
import { getImageCleanupReadiness } from "@/lib/uploads/cleanup";

const PAGE_SIZE = 20;
const MAX_SEARCH_LENGTH = 80;

export type AdminPromptStatus = "all" | PromptReviewStatus;
export type PromptImportStatus = "missing_media" | "needs_review" | "ready";
export type AdminPromptQuality = "all" | PromptImportStatus;

interface PromptReviewRow {
  created_at: string;
  decision: PromptReviewStatus;
  id: string;
  note: string | null;
  reviewer_id: string;
}

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
  collection_prompts: { collection_id: string; position: number }[];
  created_at: string;
  id: string;
  import_note: string | null;
  import_status: PromptImportStatus | null;
  is_nsfw: boolean;
  feature: {
    position: number;
    recommendation: string;
  } | {
    position: number;
    recommendation: string;
  }[] | null;
  prompt_images: PromptImageRow[];
  prompt_ai_tools: {
    tool: AiToolRow | AiToolRow[] | null;
  }[];
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
  verifiedTools: AiTool[];
}

export interface AdminPromptDetail {
  authorName: string;
  authorUrl: string;
  category: TaxonomyCategory;
  collectionMemberships: { collectionId: string; position: number }[];
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
  featurePosition: number;
  featureRecommendation: string;
  featured: boolean;
  prompt: string;
  published: boolean;
  reviewNote: string | null;
  reviewHistory: {
    decision: PromptReviewStatus;
    id: string;
    note: string | null;
    reviewedAt: string;
    reviewerName: string;
  }[];
  reviewStatus: PromptReviewStatus;
  reviewedAt: string | null;
  slug: string;
  sourceUrl: string;
  tags: TaxonomyTag[];
  title: string;
  userId: string | null;
  verifiedTools: AiTool[];
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

function parseQuality(value: string | undefined): AdminPromptQuality {
  return value === "ready" ||
    value === "needs_review" ||
    value === "missing_media"
    ? value
    : "all";
}

function parseCategory(value: string | undefined) {
  return value && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value) ? value : "";
}

function publicImageUrl(objectKey: string) {
  const baseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return baseUrl ? `${baseUrl}/${objectKey}` : undefined;
}

export interface AdminPromptSearchParams {
  category?: string | string[];
  page?: string | string[];
  q?: string | string[];
  quality?: string | string[];
  status?: string | string[];
}

export interface AdminReviewNavigation {
  category: string;
  next: { id: string; title: string } | null;
  page: number;
  previous: { id: string; title: string } | null;
  quality: AdminPromptQuality;
  query: string;
  status: PromptReviewStatus;
}

export async function getAdminPrompts(raw: AdminPromptSearchParams) {
  const { profile, supabase } = await requireAdmin();
  const page = parsePage(first(raw.page));
  const query = cleanSearch(first(raw.q));
  const category = parseCategory(first(raw.category));
  const quality = parseQuality(first(raw.quality));
  const status = parseStatus(first(raw.status));
  const from = (page - 1) * PAGE_SIZE;

  let listQuery = supabase
    .from("prompts")
    .select(
      "id,slug,title,author_name,source_url,is_nsfw,content_relation,import_status,import_note,published,published_at,review_status,review_note,reviewed_at,created_at,category:categories!prompts_category_key_fkey(key,name,sort_order),prompt_images(id,position,object_key,alt,width,height),prompt_ai_tools(tool:ai_tools!prompt_ai_tools_tool_key_fkey(key,name,description,logo_url,website_url,active,sort_order)),prompt_tags(tag:tags(key,name,kind,sort_order))",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status !== "all") {
    listQuery = listQuery.eq("review_status", status);
  }

  if (quality !== "all") {
    listQuery = listQuery.eq("import_status", quality);
  }

  if (category) {
    listQuery = listQuery.eq("category_key", category);
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
      category,
      error: "作品列表加载失败，请检查管理员权限和数据库迁移。",
      items: [] as AdminPromptListItem[],
      page,
      pageSize: PAGE_SIZE,
      profile,
      quality,
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
      verifiedTools: sortAiTools(
        row.prompt_ai_tools.flatMap(({ tool }) => {
          const value = aiToolFromRelation(tool);
          return value ? [value] : [];
        }),
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
    category,
    error: undefined,
    items,
    page,
    pageSize: PAGE_SIZE,
    profile,
    quality,
    query,
    status,
    total: listResult.count ?? 0,
  };
}

export async function getAdminPrompt(id: string) {
  const { supabase } = await requireAdmin();
  const [promptResult, historyResult] = await Promise.all([
    supabase
      .from("prompts")
      .select(
        "id,user_id,slug,title,prompt,author_name,author_url,source_url,is_nsfw,content_relation,published,published_at,review_status,review_note,reviewed_at,created_at,category:categories!prompts_category_key_fkey(key,name,sort_order),feature:prompt_features(recommendation,position),collection_prompts(collection_id,position),prompt_images(id,position,object_key,alt,width,height),prompt_ai_tools(tool:ai_tools!prompt_ai_tools_tool_key_fkey(key,name,description,logo_url,website_url,active,sort_order)),prompt_tags(tag:tags(key,name,kind,sort_order))",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("prompt_reviews")
      .select("id,decision,note,created_at,reviewer_id")
      .eq("prompt_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const { data, error } = promptResult;

  if (error) {
    console.warn("Unable to load admin prompt", error.code);
    throw new Error("作品加载失败，请稍后重试。");
  }

  if (!data) return null;

  if (historyResult.error) {
    console.warn("Unable to load prompt review history", historyResult.error.code);
    throw new Error("审核记录加载失败，请稍后重试。");
  }

  const historyRows = (historyResult.data ?? []) as PromptReviewRow[];
  const reviewerIds = [...new Set(historyRows.map((row) => row.reviewer_id))];
  const reviewerResult = reviewerIds.length
    ? await supabase
        .from("profiles")
        .select("id,display_name")
        .in("id", reviewerIds)
    : { data: [], error: null };

  if (reviewerResult.error) {
    console.warn("Unable to load prompt reviewers", reviewerResult.error.code);
  }

  const reviewerNames = new Map(
    (reviewerResult.data ?? []).map((profile) => [
      profile.id,
      profile.display_name?.trim() || "管理员",
    ]),
  );

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

  const feature = Array.isArray(row.feature) ? row.feature[0] : row.feature;

  return {
    authorName: row.author_name,
    authorUrl: row.author_url,
    category: {
      key: category.key,
      name: category.name,
      sortOrder: category.sort_order,
    },
    collectionMemberships: [...row.collection_prompts]
      .sort((left, right) => left.position - right.position)
      .map((membership) => ({
        collectionId: membership.collection_id,
        position: membership.position,
      })),
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
    featured: Boolean(feature),
    featurePosition: feature?.position ?? 100,
    featureRecommendation: feature?.recommendation ?? "",
    prompt: row.prompt,
    published: row.published,
    reviewNote: row.review_note,
    reviewHistory: historyRows.map((review) => ({
      decision: review.decision,
      id: review.id,
      note: review.note,
      reviewedAt: review.created_at,
      reviewerName: reviewerNames.get(review.reviewer_id) ?? "管理员",
    })),
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
    verifiedTools: sortAiTools(
      row.prompt_ai_tools.flatMap(({ tool }) => {
        const value = aiToolFromRelation(tool);
        return value ? [value] : [];
      }),
    ),
  } satisfies AdminPromptDetail;
}

export async function getAdminReviewNavigation({
  createdAt,
  currentId,
  currentStatus,
  raw,
}: {
  createdAt: string;
  currentId: string;
  currentStatus: PromptReviewStatus;
  raw: AdminPromptSearchParams;
}): Promise<AdminReviewNavigation> {
  const { supabase } = await requireAdmin();
  const parsedStatus = parseStatus(first(raw.status));
  const status = parsedStatus === "all" ? currentStatus : parsedStatus;
  const category = parseCategory(first(raw.category));
  const quality = parseQuality(first(raw.quality));
  const query = cleanSearch(first(raw.q));
  const page = parsePage(first(raw.page));

  let previousQuery = supabase
    .from("prompts")
    .select("id,title")
    .eq("review_status", status)
    .neq("id", currentId)
    .or(
      `created_at.gt.${createdAt},and(created_at.eq.${createdAt},id.gt.${currentId})`,
    )
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);
  let nextQuery = supabase
    .from("prompts")
    .select("id,title")
    .eq("review_status", status)
    .neq("id", currentId)
    .or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${currentId})`,
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1);

  if (quality !== "all") {
    previousQuery = previousQuery.eq("import_status", quality);
    nextQuery = nextQuery.eq("import_status", quality);
  }

  if (category) {
    previousQuery = previousQuery.eq("category_key", category);
    nextQuery = nextQuery.eq("category_key", category);
  }

  if (query) {
    const pattern = `%${query.replaceAll("_", "\\_")}%`;
    const filter =
      `title.ilike.${pattern},author_name.ilike.${pattern},slug.ilike.${pattern}`;
    previousQuery = previousQuery.or(filter);
    nextQuery = nextQuery.or(filter);
  }

  const [previousResult, nextResult] = await Promise.all([
    previousQuery.maybeSingle(),
    nextQuery.maybeSingle(),
  ]);
  const error = previousResult.error ?? nextResult.error;

  if (error) {
    console.warn("Unable to load admin review navigation", error.code);
    throw new Error("审核队列导航加载失败，请返回列表后重试。");
  }

  return {
    category,
    next: nextResult.data,
    page,
    previous: previousResult.data,
    quality,
    query,
    status,
  };
}

export async function getAdminOverview() {
  const content = await getAdminPrompts({});
  const { supabase } = await requireAdmin();
  const [
    users,
    categories,
    tags,
    collections,
    comments,
    engagement,
    imageCleanup,
    analyticsStorage,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("categories").select("key", { count: "exact", head: true }),
    supabase.from("tags").select("key", { count: "exact", head: true }),
    supabase.from("collections").select("id", { count: "exact", head: true }),
    supabase
      .from("prompt_comments")
      .select("id", { count: "exact", head: true })
      .eq("review_status", "pending"),
    supabase.rpc("admin_get_engagement_overview"),
    supabase.rpc("admin_get_image_cleanup_overview"),
    getAdminAnalyticsStorageOverview(),
  ]);

  const error = users.error ?? categories.error ?? tags.error ??
    collections.error ?? comments.error ?? engagement.error ?? imageCleanup.error;
  if (error) {
    console.warn("Unable to load admin overview", error.code);
  }

  const rawEngagement =
    engagement.data && typeof engagement.data === "object"
      ? (engagement.data as Record<string, unknown>)
      : {};
  const count = (value: unknown) => {
    const parsed = typeof value === "string" ? Number(value) : value;
    return typeof parsed === "number" &&
      Number.isSafeInteger(parsed) &&
      parsed > 0
      ? parsed
      : 0;
  };
  const rawImageCleanup =
    imageCleanup.data && typeof imageCleanup.data === "object"
      ? (imageCleanup.data as Record<string, unknown>)
      : {};
  const cleanupReadiness = getImageCleanupReadiness();

  return {
    content,
    counts: {
      categories: categories.count ?? 0,
      collections: collections.count ?? 0,
      pendingComments: comments.count ?? 0,
      tags: tags.count ?? 0,
      users: users.count ?? 0,
    },
    engagement: {
      copies: count(rawEngagement.copies),
      likes: count(rawEngagement.likes),
      reactions: count(rawEngagement.reactions),
      views: count(rawEngagement.views),
    },
    analyticsStorage,
    imageCleanup: {
      configured: cleanupReadiness.configured,
      failed: count(rawImageCleanup.failed_cleanup),
      missing: cleanupReadiness.missing,
      oldestPendingAt:
        typeof rawImageCleanup.oldest_pending_at === "string"
          ? rawImageCleanup.oldest_pending_at
          : null,
      pending: count(rawImageCleanup.pending_cleanup),
      registered: count(rawImageCleanup.registered_objects),
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
