"use server";

import { updateTag } from "next/cache";

import {
  isAiToolKey,
  MAX_VERIFIED_AI_TOOLS,
  normalizeAiToolKeys,
  type AiToolKey,
} from "@/lib/content/ai-tools";
import {
  isContentRelation,
  type ContentRelation,
} from "@/lib/content/relation";
import {
  isTaxonomyKey,
  MAX_PROMPT_TAGS,
  normalizeTaxonomyKeys,
} from "@/lib/content/taxonomy";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { MAX_PROMPT_IMAGES } from "@/lib/uploads/constraints";

const MAX_TITLE_LENGTH = 120;
const MAX_PROMPT_LENGTH = 20000;
const MAX_AUTHOR_NAME_LENGTH = 80;
const MAX_OBJECT_KEY_LENGTH = 512;

export interface PublishPromptImageInput {
  alt: string;
  height: number;
  objectKey: string;
  position: number;
  width: number;
}

export interface PublishPromptInput {
  authorName: string;
  authorUrl: string;
  categoryKey: string;
  contentRelation: ContentRelation;
  images: PublishPromptImageInput[];
  isNsfw: boolean;
  prompt: string;
  sourceUrl: string;
  tagKeys: string[];
  title: string;
  verifiedTools: AiToolKey[];
}

export type PublishPromptResult =
  | { error: string; ok: false }
  | { ok: true; slug: string };

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") &&
      value.length <= 2048;
  } catch {
    return false;
  }
}

function invalidInput(input: PublishPromptInput, userId: string) {
  if (!input.title || input.title.length > MAX_TITLE_LENGTH) {
    return "标题不能为空，且不能超过 120 个字符。";
  }

  if (!input.prompt || input.prompt.length > MAX_PROMPT_LENGTH) {
    return "提示词不能为空，且不能超过 20000 个字符。";
  }

  if (!input.authorName || input.authorName.length > MAX_AUTHOR_NAME_LENGTH) {
    return "请填写作者名称，且不能超过 80 个字符。";
  }

  if (!validHttpUrl(input.authorUrl)) {
    return "请输入有效的作者链接（需要以 http:// 或 https:// 开头）。";
  }

  if (!validHttpUrl(input.sourceUrl)) {
    return "请输入有效的来源链接（需要以 http:// 或 https:// 开头）。";
  }

  if (!isContentRelation(input.contentRelation)) {
    return "请选择有效的内容关系。";
  }

  if (!isTaxonomyKey(input.categoryKey)) {
    return "请选择作品的主分类。";
  }

  if (
    !Array.isArray(input.tagKeys) ||
    input.tagKeys.length < 1 ||
    input.tagKeys.length > MAX_PROMPT_TAGS ||
    input.tagKeys.some((tag) => !isTaxonomyKey(tag)) ||
    new Set(input.tagKeys).size !== input.tagKeys.length
  ) {
    return `请选择 1-${MAX_PROMPT_TAGS} 个有效标签。`;
  }

  if (
    !Array.isArray(input.verifiedTools) ||
    input.verifiedTools.length > MAX_VERIFIED_AI_TOOLS ||
    input.verifiedTools.some((tool) => !isAiToolKey(tool)) ||
    new Set(input.verifiedTools).size !== input.verifiedTools.length
  ) {
    return "已验证工具信息无效，请重新选择。";
  }

  if (
    !Array.isArray(input.images) ||
    input.images.length < 1 ||
    input.images.length > MAX_PROMPT_IMAGES
  ) {
    return `请添加 1-${MAX_PROMPT_IMAGES} 张图片。`;
  }

  const expectedPrefix = `prompts/${userId}/`;
  const positions = new Set<number>();

  for (const image of input.images) {
    if (
      !image ||
      typeof image.objectKey !== "string" ||
      image.objectKey.length > MAX_OBJECT_KEY_LENGTH ||
      !image.objectKey.startsWith(expectedPrefix) ||
      !/\.(?:avif|jpg|png|webp)$/.test(image.objectKey) ||
      typeof image.alt !== "string" ||
      image.alt.length > 240 ||
      !Number.isSafeInteger(image.position) ||
      image.position < 1 ||
      positions.has(image.position) ||
      !Number.isSafeInteger(image.width) ||
      !Number.isSafeInteger(image.height) ||
      image.width < 1 ||
      image.height < 1 ||
      image.width > 12000 ||
      image.height > 12000
    ) {
      return "图片信息不完整，请删除后重新添加。";
    }

    positions.add(image.position);
  }

  for (let position = 1; position <= input.images.length; position += 1) {
    if (!positions.has(position)) {
      return "图片顺序不正确，请重新排列后再试。";
    }
  }
}

export async function publishPrompt(
  rawInput: PublishPromptInput,
): Promise<PublishPromptResult> {
  if (!hasSupabasePublicConfig()) {
    return { error: "内容服务尚未完成配置，请稍后再试。", ok: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email_confirmed_at) {
    return { error: "请先登录并完成邮箱验证后再提交作品。", ok: false };
  }

  const input: PublishPromptInput = {
    authorName: clean(rawInput?.authorName),
    authorUrl: clean(rawInput?.authorUrl),
    categoryKey: clean(rawInput?.categoryKey),
    contentRelation: rawInput.contentRelation,
    images: Array.isArray(rawInput?.images) ? rawInput.images : [],
    isNsfw: rawInput?.isNsfw === true,
    prompt: clean(rawInput?.prompt),
    sourceUrl: clean(rawInput?.sourceUrl),
    tagKeys: Array.isArray(rawInput?.tagKeys) ? rawInput.tagKeys : [],
    title: clean(rawInput?.title),
    verifiedTools: Array.isArray(rawInput?.verifiedTools)
      ? rawInput.verifiedTools
      : [],
  };
  const error = invalidInput(input, user.id);

  if (error) {
    return { error, ok: false };
  }

  const slug = `fj-${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const { error: insertError } = await supabase.rpc(
    "create_prompt_with_images",
    {
      p_author_name: input.authorName,
      p_author_url: input.authorUrl,
      p_category_key: input.categoryKey,
      p_content_relation: input.contentRelation,
      p_images: input.images.map((image) => ({
        alt: image.alt,
        height: image.height,
        object_key: image.objectKey,
        position: image.position,
        width: image.width,
      })),
      p_is_nsfw: input.isNsfw,
      p_prompt: input.prompt,
      p_slug: slug,
      p_source_url: input.sourceUrl,
      p_tag_keys: normalizeTaxonomyKeys(input.tagKeys),
      p_title: input.title,
      p_tool_keys: normalizeAiToolKeys(input.verifiedTools),
    },
  );

  if (insertError) {
    console.warn("Unable to create prompt", insertError.code);
    return {
      error: "作品提交失败，请检查数据库迁移是否已执行后重试。",
      ok: false,
    };
  }

  updateTag("prompts");
  return { ok: true, slug };
}
