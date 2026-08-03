"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";

import { getSiteUrl, hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

const MIN_PASSWORD_LENGTH = 10;

function value(formData: FormData, name: string) {
  const field = formData.get(name);
  return typeof field === "string" ? field.trim() : "";
}

function rawValue(formData: FormData, name: string) {
  const field = formData.get(name);
  return typeof field === "string" ? field : "";
}

function isEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isSafePath(path: string) {
  return path.startsWith("/") && !path.startsWith("//");
}

function authUrl(path: string, kind: "error" | "success", message: string) {
  const params = new URLSearchParams({ [kind]: message });
  return `${path}?${params.toString()}` as Route;
}

function configurationError(path: string) {
  redirect(authUrl(path, "error", "认证服务尚未完成配置，请稍后再试。"));
}

function passwordError(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `密码至少需要 ${MIN_PASSWORD_LENGTH} 个字符。`;
  }

  if (password.length > 128) {
    return "密码不能超过 128 个字符。";
  }
}

export async function signIn(formData: FormData) {
  if (!hasSupabasePublicConfig()) {
    configurationError("/login");
  }

  const email = value(formData, "email").toLowerCase();
  const password = rawValue(formData, "password");
  const requestedNext = value(formData, "next");
  const next = (isSafePath(requestedNext) ? requestedNext : "/account") as Route;

  if (!isEmail(email) || !password) {
    redirect(authUrl("/login", "error", "请输入有效邮箱和密码。"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const message =
      error.code === "email_not_confirmed"
        ? "请先完成邮箱验证。"
        : "邮箱或密码不正确。";
    redirect(authUrl("/login", "error", message));
  }

  redirect(next);
}

export async function signUp(formData: FormData) {
  if (!hasSupabasePublicConfig()) {
    configurationError("/register");
  }

  const displayName = value(formData, "displayName");
  const email = value(formData, "email").toLowerCase();
  const password = rawValue(formData, "password");
  const confirmation = rawValue(formData, "passwordConfirmation");

  if (!isEmail(email)) {
    redirect(authUrl("/register", "error", "请输入有效邮箱。"));
  }

  if (displayName.length > 50) {
    redirect(authUrl("/register", "error", "昵称不能超过 50 个字符。"));
  }

  const validationError = passwordError(password);
  if (validationError) {
    redirect(authUrl("/register", "error", validationError));
  }

  if (password !== confirmation) {
    redirect(authUrl("/register", "error", "两次输入的密码不一致。"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName || null },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/account`,
    },
  });

  if (error) {
    const message =
      error.code === "weak_password"
        ? "该密码不符合安全要求，请换一个更长且不常见的密码。"
        : "注册暂未完成，请稍后重试。";
    redirect(authUrl("/register", "error", message));
  }

  redirect(
    authUrl(
      "/login",
      "success",
      "验证邮件已发送。完成邮箱验证后即可登录。",
    ),
  );
}

export async function requestPasswordReset(formData: FormData) {
  if (!hasSupabasePublicConfig()) {
    configurationError("/forgot-password");
  }

  const email = value(formData, "email").toLowerCase();
  if (!isEmail(email)) {
    redirect(authUrl("/forgot-password", "error", "请输入有效邮箱。"));
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/reset-password`,
  });

  redirect(
    authUrl(
      "/forgot-password",
      "success",
      "如果该邮箱已注册，密码重置邮件将在几分钟内送达。",
    ),
  );
}

export async function updatePassword(formData: FormData) {
  if (!hasSupabasePublicConfig()) {
    configurationError("/reset-password");
  }

  const password = rawValue(formData, "password");
  const confirmation = rawValue(formData, "passwordConfirmation");
  const validationError = passwordError(password);

  if (validationError) {
    redirect(authUrl("/reset-password", "error", validationError));
  }

  if (password !== confirmation) {
    redirect(authUrl("/reset-password", "error", "两次输入的密码不一致。"));
  }

  const supabase = await createClient();
  const { data, error: userError } = await supabase.auth.getUser();

  if (userError || !data.user) {
    redirect(
      authUrl("/forgot-password", "error", "重置链接已失效，请重新申请。"),
    );
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    redirect(authUrl("/reset-password", "error", "密码更新失败，请重新申请重置链接。"));
  }

  redirect(authUrl("/account", "success", "密码已经更新。"));
}

export async function signOut() {
  if (hasSupabasePublicConfig()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  redirect("/");
}
