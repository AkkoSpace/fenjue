"use server";

import { revalidatePath, updateTag } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";

import { adminMessageUrl, cleanAdminInput } from "./action-utils";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function reviewPromptComment(formData: FormData) {
  const id = cleanAdminInput(formData.get("id"));
  const slug = cleanAdminInput(formData.get("slug"));
  const note = cleanAdminInput(formData.get("note"));
  const decision = cleanAdminInput(formData.get("decision"));
  const returnTo = cleanAdminInput(formData.get("returnTo")) || "/admin/comments";

  if (
    !UUID_PATTERN.test(id) ||
    (decision !== "approved" && decision !== "rejected" && decision !== "pending") ||
    note.length > 1000 ||
    (decision === "rejected" && !note)
  ) {
    redirect(adminMessageUrl(returnTo, "error", "评价审核信息无效。"));
  }

  const { supabase } = await requireAdmin("/admin/comments" as Route);
  const { error } = await supabase.rpc("admin_review_prompt_comment", {
    p_comment_id: id,
    p_decision: decision,
    p_note: note || null,
  });

  if (error) {
    console.warn("Unable to review prompt comment", error.code);
    redirect(adminMessageUrl(returnTo, "error", "评价审核失败，请稍后重试。"));
  }

  updateTag(`comments:${slug}`);
  revalidatePath(`/prompts/${slug}`);
  revalidatePath("/account");
  revalidatePath("/admin/comments");
  redirect(
    adminMessageUrl(
      returnTo,
      "success",
      decision === "approved" ? "评价已通过并公开。" : "评价审核状态已更新。",
    ),
  );
}
