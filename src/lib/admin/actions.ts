"use server";

import { updateTag } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";
import {
  isAiToolKey,
  normalizeAiToolKeys,
  type AiToolKey,
} from "@/lib/content/ai-tools";
import {
  isContentRelation,
  type ContentRelation,
} from "@/lib/content/relation";
import {
  isPromptReviewStatus,
  PROMPT_REVIEW_STATUS_META,
} from "@/lib/content/review";
import {
  isTaxonomyKey,
  MAX_PROMPT_TAGS,
  normalizeTaxonomyKeys,
} from "@/lib/content/taxonomy";
import { deleteImageObjects, hasR2WriteConfig } from "@/lib/r2/server";
import { MAX_PROMPT_IMAGES } from "@/lib/uploads/constraints";

import {
  adminMessageUrl,
  cleanAdminInput,
  UUID_PATTERN,
} from "./action-utils";

interface PromptWithImages {
  id: string;
  prompt_images: { object_key: string }[];
  title: string;
}

function invalidIdUrl(returnTo: string) {
  return adminMessageUrl(returnTo, "error", "作品标识无效，请刷新页面后重试。");
}

export async function reviewPrompt(formData: FormData) {
  const id = cleanAdminInput(formData.get("id"));
  const returnTo = cleanAdminInput(formData.get("returnTo"));
  const decision = cleanAdminInput(formData.get("decision"));
  const note = cleanAdminInput(formData.get("note"));

  if (!UUID_PATTERN.test(id)) {
    redirect(invalidIdUrl(returnTo));
  }

  if (!isPromptReviewStatus(decision)) {
    redirect(adminMessageUrl(returnTo, "error", "审核结论无效，请重试。"));
  }

  if (decision === "rejected" && !note) {
    redirect(
      adminMessageUrl(
        returnTo,
        "error",
        "驳回作品时需要填写原因，方便投稿者修改。",
      ),
    );
  }

  if (note.length > 2000) {
    redirect(adminMessageUrl(returnTo, "error", "审核备注不能超过 2000 个字符。"));
  }

  const { supabase } = await requireAdmin("/admin" as Route);
  const { data, error } = await supabase.rpc("admin_review_prompt", {
    p_decision: decision,
    p_id: id,
    p_note: note || null,
  });

  if (error || typeof data !== "string") {
    console.warn("Unable to review prompt", error?.code);
    redirect(
      adminMessageUrl(
        returnTo,
        "error",
        decision === "approved"
          ? "审核未完成，请确认作品至少有一张图片、有效分类和标签。"
          : "审核状态更新失败，请稍后重试。",
      ),
    );
  }

  updateTag("prompts");
  redirect(
    adminMessageUrl(
      returnTo,
      "success",
      decision === "approved"
        ? "作品已通过审核并公开展示。"
        : `作品已设为${PROMPT_REVIEW_STATUS_META[decision].label}。`,
    ),
  );
}

export async function deletePrompt(formData: FormData) {
  const id = cleanAdminInput(formData.get("id"));
  const returnTo = cleanAdminInput(formData.get("returnTo"));

  if (!UUID_PATTERN.test(id)) {
    redirect(invalidIdUrl(returnTo));
  }

  const { supabase } = await requireAdmin("/admin" as Route);

  if (!hasR2WriteConfig()) {
    redirect(
      adminMessageUrl(
        returnTo,
        "error",
        "R2 写入配置尚未完成，暂时不能永久删除；可以先将作品下架。",
      ),
    );
  }

  const { data, error: readError } = await supabase
    .from("prompts")
    .select("id,title,prompt_images(object_key)")
    .eq("id", id)
    .maybeSingle();
  const prompt = data as PromptWithImages | null;

  if (readError || !prompt) {
    console.warn("Unable to find prompt for deletion", readError?.code);
    redirect(adminMessageUrl(returnTo, "error", "没有找到要删除的作品。"));
  }

  const { error: deleteError } = await supabase
    .from("prompts")
    .delete()
    .eq("id", prompt.id);

  if (deleteError) {
    console.warn("Unable to delete prompt", deleteError.code);
    redirect(adminMessageUrl(returnTo, "error", "作品删除失败，请稍后重试。"));
  }

  updateTag("prompts");

  try {
    await deleteImageObjects(
      prompt.prompt_images.map((image) => image.object_key),
    );
  } catch (error) {
    console.warn("Unable to delete prompt images from R2", error);
    redirect(
      adminMessageUrl(
        returnTo,
        "warning",
        `《${prompt.title}》的记录已删除，但 R2 图片清理失败，请检查存储配置。`,
      ),
    );
  }

  redirect(
    adminMessageUrl(returnTo, "success", `《${prompt.title}》已永久删除。`),
  );
}

export interface UpdateAdminPromptImageInput {
  alt: string;
  height: number;
  objectKey: string;
  position: number;
  width: number;
}

export interface UpdateAdminPromptInput {
  authorName: string;
  authorUrl: string;
  categoryKey: string;
  contentRelation: ContentRelation;
  id: string;
  images: UpdateAdminPromptImageInput[];
  isNsfw: boolean;
  prompt: string;
  sourceUrl: string;
  tagKeys: string[];
  title: string;
  verifiedTools: AiToolKey[];
}

export type UpdateAdminPromptResult =
  | { error: string; ok: false }
  | { ok: true; slug: string; warning?: string };

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      value.length <= 2048
    );
  } catch {
    return false;
  }
}

function validatePromptEdit(
  input: UpdateAdminPromptInput,
  allowedExistingKeys: Set<string>,
  adminId: string,
) {
  if (!UUID_PATTERN.test(input.id)) return "作品标识无效，请刷新后重试。";
  if (!input.title || input.title.length > 120) {
    return "标题不能为空，且不能超过 120 个字符。";
  }
  if (!input.prompt || input.prompt.length > 20000) {
    return "提示词不能为空，且不能超过 20000 个字符。";
  }
  if (!input.authorName || input.authorName.length > 80) {
    return "作者名称不能为空，且不能超过 80 个字符。";
  }
  if (!validHttpUrl(input.authorUrl) || !validHttpUrl(input.sourceUrl)) {
    return "作者链接和来源链接都需要是有效的 HTTP 地址。";
  }
  if (!isContentRelation(input.contentRelation)) return "内容关系无效。";
  if (!isTaxonomyKey(input.categoryKey)) return "作品分类无效。";
  if (
    input.tagKeys.length < 1 ||
    input.tagKeys.length > MAX_PROMPT_TAGS ||
    input.tagKeys.some((key) => !isTaxonomyKey(key)) ||
    new Set(input.tagKeys).size !== input.tagKeys.length
  ) {
    return `请选择 1-${MAX_PROMPT_TAGS} 个有效标签。`;
  }
  if (
    input.verifiedTools.length > 4 ||
    input.verifiedTools.some((tool) => !isAiToolKey(tool)) ||
    new Set(input.verifiedTools).size !== input.verifiedTools.length
  ) {
    return "已验证平台信息无效。";
  }
  if (
    input.images.length < 1 ||
    input.images.length > MAX_PROMPT_IMAGES
  ) {
    return `请保留 1-${MAX_PROMPT_IMAGES} 张图片。`;
  }

  const positions = new Set<number>();
  const objectKeys = new Set<string>();
  const uploadedPrefix = `prompts/${adminId}/`;

  for (const image of input.images) {
    if (
      !image ||
      (!allowedExistingKeys.has(image.objectKey) &&
        !image.objectKey.startsWith(uploadedPrefix)) ||
      !/\.(?:avif|jpg|png|webp)$/.test(image.objectKey) ||
      image.objectKey.length > 512 ||
      image.alt.length > 240 ||
      !Number.isSafeInteger(image.position) ||
      image.position < 1 ||
      positions.has(image.position) ||
      objectKeys.has(image.objectKey) ||
      !Number.isSafeInteger(image.width) ||
      !Number.isSafeInteger(image.height) ||
      image.width < 1 ||
      image.height < 1 ||
      image.width > 12000 ||
      image.height > 12000
    ) {
      return "图片信息不完整，请重新检查顺序和替代文本。";
    }

    positions.add(image.position);
    objectKeys.add(image.objectKey);
  }

  for (let position = 1; position <= input.images.length; position += 1) {
    if (!positions.has(position)) return "图片顺序不连续，请重新排列。";
  }
}

export async function updateAdminPrompt(
  rawInput: UpdateAdminPromptInput,
): Promise<UpdateAdminPromptResult> {
  const { supabase, user } = await requireAdmin(
    "/admin/content" as Route,
  );
  const input: UpdateAdminPromptInput = {
    authorName: cleanAdminInput(rawInput?.authorName),
    authorUrl: cleanAdminInput(rawInput?.authorUrl),
    categoryKey: cleanAdminInput(rawInput?.categoryKey),
    contentRelation: rawInput?.contentRelation,
    id: cleanAdminInput(rawInput?.id),
    images: Array.isArray(rawInput?.images) ? rawInput.images : [],
    isNsfw: rawInput?.isNsfw === true,
    prompt: cleanAdminInput(rawInput?.prompt),
    sourceUrl: cleanAdminInput(rawInput?.sourceUrl),
    tagKeys: Array.isArray(rawInput?.tagKeys) ? rawInput.tagKeys : [],
    title: cleanAdminInput(rawInput?.title),
    verifiedTools: Array.isArray(rawInput?.verifiedTools)
      ? rawInput.verifiedTools
      : [],
  };

  if (!UUID_PATTERN.test(input.id)) {
    return { error: "作品标识无效，请刷新后重试。", ok: false };
  }

  const { data: current, error: currentError } = await supabase
    .from("prompts")
    .select("slug,prompt_images(object_key)")
    .eq("id", input.id)
    .maybeSingle();

  if (currentError || !current) {
    console.warn("Unable to read prompt before update", currentError?.code);
    return { error: "没有找到要编辑的作品。", ok: false };
  }

  const existingKeys = new Set(
    current.prompt_images.map((image) => image.object_key),
  );
  const inputError = validatePromptEdit(input, existingKeys, user.id);
  if (inputError) return { error: inputError, ok: false };

  const retainedKeys = new Set(input.images.map((image) => image.objectKey));
  const willRemove = [...existingKeys].filter((key) => !retainedKeys.has(key));
  if (willRemove.length && !hasR2WriteConfig()) {
    return {
      error: "R2 写入配置不完整，当前不能删除已有图片。",
      ok: false,
    };
  }

  const { data, error } = await supabase.rpc("admin_update_prompt_content", {
    p_author_name: input.authorName,
    p_author_url: input.authorUrl,
    p_category_key: input.categoryKey,
    p_content_relation: input.contentRelation,
    p_id: input.id,
    p_images: input.images.map((image) => ({
      alt: image.alt,
      height: image.height,
      object_key: image.objectKey,
      position: image.position,
      width: image.width,
    })),
    p_is_nsfw: input.isNsfw,
    p_prompt: input.prompt,
    p_source_url: input.sourceUrl,
    p_tag_keys: normalizeTaxonomyKeys(input.tagKeys),
    p_title: input.title,
    p_tool_keys: normalizeAiToolKeys(input.verifiedTools),
  });

  if (error) {
    console.warn("Unable to update admin prompt", error.code);
    return {
      error: "作品保存失败，请确认分类、标签和数据库迁移均为最新状态。",
      ok: false,
    };
  }

  updateTag("prompts");
  const removedKeys = Array.isArray(data)
    ? data.filter((key): key is string => typeof key === "string")
    : [];

  if (removedKeys.length) {
    try {
      await deleteImageObjects(removedKeys);
    } catch (deleteError) {
      console.warn("Unable to delete removed prompt images from R2", deleteError);
      return {
        ok: true,
        slug: current.slug,
        warning: "内容已经保存，但有旧图片未能从 R2 清理，请稍后人工检查。",
      };
    }
  }

  return { ok: true, slug: current.slug };
}
