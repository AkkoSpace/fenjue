"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";
import { isSourcePlatformKey } from "@/lib/content/source-platforms";

import { adminMessageUrl, cleanAdminInput } from "./action-utils";

const RETURN_TO = "/admin/platforms";

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

export async function saveSourcePlatform(formData: FormData) {
  const intent = cleanAdminInput(formData.get("intent"));
  const key = cleanAdminInput(formData.get("key"));
  const name = cleanAdminInput(formData.get("name"));
  const logoUrl = cleanAdminInput(formData.get("logoUrl"));
  const brandColor = cleanAdminInput(formData.get("brandColor"));
  const websiteUrl = cleanAdminInput(formData.get("websiteUrl"));
  const active = formData
    .getAll("active")
    .some((value) => cleanAdminInput(value) === "true");
  const sortOrder = Number.parseInt(cleanAdminInput(formData.get("sortOrder")), 10);

  if (
    (intent !== "create" && intent !== "update") ||
    !isSourcePlatformKey(key) ||
    !name ||
    name.length > 48 ||
    !optionalHttpsUrl(logoUrl) ||
    !optionalHttpsUrl(websiteUrl) ||
    !optionalBrandColor(brandColor) ||
    !Number.isSafeInteger(sortOrder) ||
    sortOrder < 1 ||
    sortOrder > 32767
  ) {
    redirect(message("error", "来源平台信息无效；Logo 与官网需要使用 HTTPS 地址。"));
  }

  const { supabase } = await requireAdmin(RETURN_TO as Route);
  const values = {
    active,
    brand_color: brandColor || null,
    key,
    logo_url: logoUrl || null,
    name,
    sort_order: sortOrder,
    website_url: websiteUrl || null,
  };
  const result = intent === "create"
    ? await supabase.from("source_platforms").insert(values)
    : await supabase.from("source_platforms").update(values).eq("key", key);

  if (result.error) {
    console.warn("Unable to save source platform", result.error.code);
    redirect(message("error", "保存失败，请检查名称或英文标识是否已经存在。"));
  }

  updateTag("source-platforms");
  updateTag("prompts");
  revalidatePath(RETURN_TO);
  revalidatePath("/submit");
  redirect(message("success", `来源平台“${name}”已保存。`));
}

export async function deleteSourcePlatform(formData: FormData) {
  const key = cleanAdminInput(formData.get("key"));
  const name = cleanAdminInput(formData.get("name"));
  if (!isSourcePlatformKey(key)) {
    redirect(message("error", "来源平台标识无效，请刷新后重试。"));
  }

  const { supabase } = await requireAdmin(RETURN_TO as Route);
  const { count, error: countError } = await supabase
    .from("prompts")
    .select("id", { count: "exact", head: true })
    .eq("source_platform_key", key);
  if (countError) {
    console.warn("Unable to check source platform usage", countError.code);
    redirect(message("error", "无法检查来源平台使用情况，请稍后重试。"));
  }
  if (count) {
    redirect(message("error", `该来源平台已有 ${count} 条作品引用，请改为停用。`));
  }

  const { error } = await supabase.from("source_platforms").delete().eq("key", key);
  if (error) {
    console.warn("Unable to delete source platform", error.code);
    redirect(message("error", "来源平台删除失败，请稍后重试。"));
  }

  updateTag("source-platforms");
  revalidatePath(RETURN_TO);
  revalidatePath("/submit");
  redirect(message("success", `来源平台“${name || key}”已删除。`));
}
