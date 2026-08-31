"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";
import { isAiToolKey } from "@/lib/content/ai-tools";

import { adminMessageUrl, cleanAdminInput } from "./action-utils";

const RETURN_TO = "/admin/models";

function message(kind: "error" | "success", value: string) {
  return adminMessageUrl(RETURN_TO, kind, value);
}

function optionalHttpsUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && value.length <= 2048;
  } catch {
    return false;
  }
}

function optionalBrandColor(value: string) {
  return !value || /^#[0-9a-f]{6}$/i.test(value);
}

export async function saveAiTool(formData: FormData) {
  const intent = cleanAdminInput(formData.get("intent"));
  const key = cleanAdminInput(formData.get("key"));
  const name = cleanAdminInput(formData.get("name"));
  const description = cleanAdminInput(formData.get("description"));
  const brandColor = cleanAdminInput(formData.get("brandColor"));
  const logoUrl = cleanAdminInput(formData.get("logoUrl"));
  const websiteUrl = cleanAdminInput(formData.get("websiteUrl"));
  const active = formData
    .getAll("active")
    .some((value) => cleanAdminInput(value) === "true");
  const sortOrder = Number.parseInt(
    cleanAdminInput(formData.get("sortOrder")),
    10,
  );

  if (
    (intent !== "create" && intent !== "update") ||
    !isAiToolKey(key) ||
    !name ||
    name.length > 48 ||
    description.length > 160 ||
    !optionalHttpsUrl(logoUrl) ||
    !optionalHttpsUrl(websiteUrl) ||
    !optionalBrandColor(brandColor) ||
    !Number.isSafeInteger(sortOrder) ||
    sortOrder < 1 ||
    sortOrder > 32767
  ) {
    redirect(
      message(
        "error",
        "模型信息无效；Logo 与官网需要使用 HTTPS 地址。",
      ),
    );
  }

  const { supabase } = await requireAdmin(RETURN_TO as Route);
  const values = {
    active,
    brand_color: brandColor || null,
    description,
    key,
    logo_url: logoUrl || null,
    name,
    sort_order: sortOrder,
    website_url: websiteUrl || null,
  };
  const result = intent === "create"
    ? await supabase.from("ai_tools").insert(values)
    : await supabase.from("ai_tools").update(values).eq("key", key);

  if (result.error) {
    console.warn("Unable to save AI tool", result.error.code);
    redirect(
      message(
        "error",
        "保存失败，请检查名称或英文标识是否已经存在。",
      ),
    );
  }

  updateTag("ai-tools");
  updateTag("prompts");
  revalidatePath(RETURN_TO);
  revalidatePath("/submit");
  redirect(message("success", `生成模型“${name}”已保存。`));
}

export async function deleteAiTool(formData: FormData) {
  const key = cleanAdminInput(formData.get("key"));
  const name = cleanAdminInput(formData.get("name"));

  if (!isAiToolKey(key)) {
    redirect(message("error", "模型标识无效，请刷新后重试。"));
  }

  const { supabase } = await requireAdmin(RETURN_TO as Route);
  const [promptResult, commentResult] = await Promise.all([
    supabase
      .from("prompt_ai_tools")
      .select("prompt_id", { count: "exact", head: true })
      .eq("tool_key", key),
    supabase
      .from("prompt_comments")
      .select("id", { count: "exact", head: true })
      .eq("tool_key", key),
  ]);
  const countError = promptResult.error ?? commentResult.error;

  if (countError) {
    console.warn("Unable to check AI tool usage", countError.code);
    redirect(message("error", "无法检查模型使用情况，请稍后重试。"));
  }

  const promptCount = promptResult.count ?? 0;
  const commentCount = commentResult.count ?? 0;
  if (promptCount || commentCount) {
    redirect(
      message(
        "error",
        `该模型已有 ${promptCount} 条作品和 ${commentCount} 条心得引用，不能删除；请改为停用，以保留历史记录。`,
      ),
    );
  }

  const { error } = await supabase.from("ai_tools").delete().eq("key", key);
  if (error) {
    console.warn("Unable to delete AI tool", error.code);
    redirect(message("error", "模型删除失败，请稍后重试。"));
  }

  updateTag("ai-tools");
  updateTag("prompts");
  revalidatePath(RETURN_TO);
  revalidatePath("/submit");
  redirect(message("success", `生成模型“${name || key}”已删除。`));
}
