"use server";

import { revalidatePath, updateTag } from "next/cache";

import { isAiToolKey } from "@/lib/content/ai-tools";
import {
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
} from "@/lib/content/editorial";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,100}$/;

export interface CommentActionState {
  message: string;
  status: "error" | "idle" | "success";
}

export const INITIAL_COMMENT_ACTION_STATE: CommentActionState = {
  message: "",
  status: "idle",
};

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

export async function submitPromptComment(
  _previous: CommentActionState,
  formData: FormData,
): Promise<CommentActionState> {
  const slug = value(formData, "slug");
  const body = value(formData, "body");
  const toolKey = value(formData, "toolKey");

  if (!SLUG_PATTERN.test(slug)) {
    return { message: "作品标识无效，请刷新后重试。", status: "error" };
  }
  if (body.length < MIN_COMMENT_LENGTH || body.length > MAX_COMMENT_LENGTH) {
    return {
      message: `心得需要填写 ${MIN_COMMENT_LENGTH}-${MAX_COMMENT_LENGTH} 个字符。`,
      status: "error",
    };
  }
  if (toolKey && !isAiToolKey(toolKey)) {
    return { message: "请选择有效的生成平台。", status: "error" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { message: "登录后才能提交实测心得。", status: "error" };
  }

  const { error } = await supabase.rpc("create_prompt_comment", {
    p_body: body,
    p_slug: slug,
    p_tool_key: toolKey || null,
  });

  if (error) {
    console.warn("Unable to create prompt comment", error.code);
    return {
      message: "心得提交失败，请确认作品仍然公开后重试。",
      status: "error",
    };
  }

  updateTag(`comments:${slug}`);
  revalidatePath(`/prompts/${slug}`);
  revalidatePath("/account");
  revalidatePath("/admin/comments");

  return {
    message: "心得已提交，管理员审核通过后会公开展示。",
    status: "success",
  };
}

export async function deleteOwnPromptComment(
  commentId: string,
): Promise<CommentActionState> {
  if (!UUID_PATTERN.test(commentId)) {
    return { message: "心得标识无效，请刷新后重试。", status: "error" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { message: "登录状态已失效。", status: "error" };

  const { data: slug, error } = await supabase.rpc("delete_own_prompt_comment", {
    p_comment_id: commentId,
  });

  if (error || typeof slug !== "string" || !SLUG_PATTERN.test(slug)) {
    console.warn("Unable to delete own prompt comment", error?.code);
    return { message: "心得删除失败，请稍后重试。", status: "error" };
  }

  updateTag(`comments:${slug}`);
  revalidatePath(`/prompts/${slug}`);
  revalidatePath("/account");
  revalidatePath("/admin/comments");
  return { message: "心得已删除。", status: "success" };
}
