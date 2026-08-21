"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/authorization";

import { adminMessageUrl, cleanAdminInput, UUID_PATTERN } from "./action-utils";

export async function setUserRole(formData: FormData) {
  const id = cleanAdminInput(formData.get("id"));
  const role = cleanAdminInput(formData.get("role"));
  const returnTo = cleanAdminInput(formData.get("returnTo")) || "/admin/users";

  if (!UUID_PATTERN.test(id) || (role !== "user" && role !== "admin")) {
    redirect(adminMessageUrl(returnTo, "error", "用户角色信息无效。"));
  }

  const { profile, supabase } = await requireAdmin("/admin/users" as Route);
  if (!profile.is_super_admin) {
    redirect(
      adminMessageUrl(returnTo, "error", "只有超级管理员可以调整用户角色。"),
    );
  }

  const { error } = await supabase.rpc("admin_set_user_role", {
    p_role: role,
    p_user_id: id,
  });

  if (error) {
    console.warn("Unable to update user role", error.code);
    redirect(adminMessageUrl(returnTo, "error", "用户角色更新失败。"));
  }

  revalidatePath("/admin/users");
  redirect(
    adminMessageUrl(
      returnTo,
      "success",
      role === "admin" ? "已授予管理员权限。" : "已恢复为普通用户。",
    ),
  );
}
