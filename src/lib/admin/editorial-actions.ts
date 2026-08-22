"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";

import { adminMessageUrl, cleanAdminInput } from "./action-utils";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

function message(kind: "error" | "success", text: string) {
  return adminMessageUrl("/admin/collections", kind, text);
}
export async function saveCollection(formData: FormData) {
  const intent = cleanAdminInput(formData.get("intent"));
  const id = cleanAdminInput(formData.get("id"));
  const slug = cleanAdminInput(formData.get("slug"));
  const title = cleanAdminInput(formData.get("title"));
  const description = cleanAdminInput(formData.get("description"));
  const published = formData
    .getAll("published")
    .some((value) => cleanAdminInput(value) === "true");
  const sortOrder = Number.parseInt(
    cleanAdminInput(formData.get("sortOrder")),
    10,
  );

  if (
    (intent !== "create" && intent !== "update") ||
    (intent === "update" && !UUID_PATTERN.test(id)) ||
    !SLUG_PATTERN.test(slug) ||
    !title ||
    title.length > 80 ||
    description.length > 500 ||
    !Number.isSafeInteger(sortOrder) ||
    sortOrder < 1 ||
    sortOrder > 32767
  ) {
    redirect(message("error", "专栏信息无效，请检查标题、标识和排序。"));
  }

  const { supabase, user } = await requireAdmin(
    "/admin/collections" as Route,
  );
  const values = {
    description,
    published,
    sort_order: sortOrder,
    title,
  };
  const result = intent === "create"
    ? await supabase.from("collections").insert({
        ...values,
        created_by: user.id,
        slug,
      })
    : await supabase.from("collections").update(values).eq("id", id);

  if (result.error) {
    console.warn("Unable to save collection", result.error.code);
    redirect(message("error", "专栏保存失败，请检查英文标识是否已经存在。"));
  }

  updateTag("editorial");
  revalidatePath("/");
  revalidatePath("/collections");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/collections");
  redirect(message("success", `专栏“${title}”已保存。`));
}
