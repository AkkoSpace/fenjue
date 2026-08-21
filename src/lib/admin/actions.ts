"use server";

import { updateTag } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";
import { deleteImageObjects, hasR2WriteConfig } from "@/lib/r2/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PromptWithImages {
  id: string;
  prompt_images: { object_key: string }[];
  title: string;
}

function clean(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

function safeAdminReturnTo(value: string) {
  if (!value.startsWith("/admin") || value.startsWith("//")) {
    return "/admin";
  }

  const url = new URL(value, "https://fenjue.local");
  return url.pathname === "/admin" ? `${url.pathname}${url.search}` : "/admin";
}

function adminMessageUrl(
  returnTo: string,
  kind: "error" | "success" | "warning",
  message: string,
) {
  const url = new URL(safeAdminReturnTo(returnTo), "https://fenjue.local");
  url.searchParams.delete("error");
  url.searchParams.delete("success");
  url.searchParams.delete("warning");
  url.searchParams.set(kind, message);
  return `${url.pathname}?${url.searchParams.toString()}` as Route;
}

function invalidIdUrl(returnTo: string) {
  return adminMessageUrl(returnTo, "error", "作品标识无效，请刷新页面后重试。");
}

export async function setPromptPublication(formData: FormData) {
  const id = clean(formData.get("id"));
  const returnTo = clean(formData.get("returnTo"));
  const published = clean(formData.get("published")) === "true";

  if (!UUID_PATTERN.test(id)) {
    redirect(invalidIdUrl(returnTo));
  }

  const { supabase } = await requireAdmin("/admin" as Route);
  const { data: prompt, error: readError } = await supabase
    .from("prompts")
    .select("title,prompt_images(id)")
    .eq("id", id)
    .maybeSingle();

  if (readError || !prompt) {
    console.warn("Unable to find prompt for publication", readError?.code);
    redirect(adminMessageUrl(returnTo, "error", "没有找到要更新的作品。"));
  }

  if (published && !prompt.prompt_images.length) {
    redirect(
      adminMessageUrl(
        returnTo,
        "error",
        `《${prompt.title}》还没有图片，补充图片后才能公开展示。`,
      ),
    );
  }

  const { data, error } = await supabase
    .from("prompts")
    .update({
      published,
      published_at: published ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .select("title")
    .maybeSingle();

  if (error || !data) {
    console.warn("Unable to update prompt publication", error?.code);
    redirect(
      adminMessageUrl(returnTo, "error", "作品状态更新失败，请稍后重试。"),
    );
  }

  updateTag("prompts");
  redirect(
    adminMessageUrl(
      returnTo,
      "success",
      published ? `《${data.title}》已恢复展示。` : `《${data.title}》已下架。`,
    ),
  );
}

export async function deletePrompt(formData: FormData) {
  const id = clean(formData.get("id"));
  const returnTo = clean(formData.get("returnTo"));

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
