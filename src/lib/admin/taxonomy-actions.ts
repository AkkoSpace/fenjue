"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";
import {
  isTaxonomyKey,
  type TaxonomyTagKind,
} from "@/lib/content/taxonomy";

import { adminMessageUrl, cleanAdminInput } from "./action-utils";

function taxonomyMessage(
  returnTo: string,
  kind: "error" | "success",
  message: string,
) {
  return adminMessageUrl(returnTo || "/admin/taxonomy", kind, message);
}

function taxonomyKind(value: string): value is TaxonomyTagKind {
  return value === "style" || value === "format" || value === "theme";
}

export async function saveTaxonomyItem(formData: FormData) {
  const entity = cleanAdminInput(formData.get("entity"));
  const intent = cleanAdminInput(formData.get("intent"));
  const key = cleanAdminInput(formData.get("key"));
  const name = cleanAdminInput(formData.get("name"));
  const kind = cleanAdminInput(formData.get("kind"));
  const active = formData
    .getAll("active")
    .some((value) => cleanAdminInput(value) === "true");
  const sortOrder = Number.parseInt(
    cleanAdminInput(formData.get("sortOrder")),
    10,
  );
  const returnTo =
    cleanAdminInput(formData.get("returnTo")) || "/admin/taxonomy";

  if (
    (entity !== "category" && entity !== "tag") ||
    (intent !== "create" && intent !== "update") ||
    !isTaxonomyKey(key) ||
    !name ||
    name.length > 32 ||
    !Number.isSafeInteger(sortOrder) ||
    sortOrder < 1 ||
    sortOrder > 32767 ||
    (entity === "tag" && !taxonomyKind(kind))
  ) {
    redirect(taxonomyMessage(returnTo, "error", "分类或标签信息无效。"));
  }

  const { supabase } = await requireAdmin("/admin/taxonomy" as Route);
  if (!active && intent === "update") {
    const usageQuery = entity === "category"
      ? supabase
          .from("prompts")
          .select("id", { count: "exact", head: true })
          .eq("category_key", key)
          .eq("published", true)
      : supabase
          .from("prompt_tags")
          .select("prompt_id,prompts!inner(id)", { count: "exact", head: true })
          .eq("tag_key", key)
          .eq("prompts.published", true);
    const { count, error: usageError } = await usageQuery;

    if (usageError) {
      console.warn("Unable to check taxonomy usage", usageError.code);
      redirect(taxonomyMessage(returnTo, "error", "无法检查当前使用情况。"));
    }
    if ((count ?? 0) > 0) {
      redirect(
        taxonomyMessage(
          returnTo,
          "error",
          `仍有 ${count} 条公开作品正在使用，不能停用。`,
        ),
      );
    }
  }

  const updatedAt = new Date().toISOString();
  let error;

  if (entity === "category") {
    const values = {
      active,
      key,
      name,
      sort_order: sortOrder,
      updated_at: updatedAt,
    };
    const result = intent === "create"
      ? await supabase.from("categories").insert(values)
      : await supabase.from("categories").update(values).eq("key", key);
    error = result.error;
  } else {
    const values = {
      active,
      key,
      kind,
      name,
      sort_order: sortOrder,
      updated_at: updatedAt,
    };
    const result = intent === "create"
      ? await supabase.from("tags").insert(values)
      : await supabase.from("tags").update(values).eq("key", key);
    error = result.error;
  }

  if (error) {
    console.warn("Unable to save taxonomy item", error.code);
    redirect(
      taxonomyMessage(
        returnTo,
        "error",
        "保存失败，请检查名称或标识是否已经存在。",
      ),
    );
  }

  updateTag("prompts");
  revalidatePath("/admin/taxonomy");
  redirect(
    taxonomyMessage(
      returnTo,
      "success",
      `${entity === "category" ? "分类" : "标签"}“${name}”已保存。`,
    ),
  );
}
