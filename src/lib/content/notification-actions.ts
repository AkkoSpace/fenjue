"use server";

import { revalidatePath } from "next/cache";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function markAllNotificationsRead() {
  if (!hasSupabasePublicConfig()) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);

  if (error) {
    console.warn("Unable to mark notifications read", error.code);
    return;
  }

  revalidatePath("/account");
}

export async function openNotification(id: string) {
  if (!hasSupabasePublicConfig()) redirect("/account");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/account");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data, error } = await supabase
    .from("notifications")
    .select("href")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.href) {
    console.warn("Unable to open notification", error?.code);
    redirect("/account");
  }

  const update = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (update.error) {
    console.warn("Unable to mark notification read", update.error.code);
  }

  redirect(data.href as Route);
}
