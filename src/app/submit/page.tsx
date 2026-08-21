import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { PromptEditor } from "@/components/submission/prompt-editor";
import { getContentTaxonomy } from "@/lib/content/queries";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  description: "提交一组可以复用的文生图提示词作品，审核后公开展示。",
  robots: { follow: false, index: false },
  title: "提交作品",
};

export default async function SubmitPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-10">
          <div className="h-10 max-w-sm animate-pulse bg-muted" />
        </main>
      }
    >
      <SubmitContent />
    </Suspense>
  );
}

async function SubmitContent() {
  if (!hasSupabasePublicConfig()) {
    redirect("/login?next=/submit");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email_confirmed_at) {
    redirect("/login?next=/submit");
  }

  const [{ data: profile }, taxonomy] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle(),
    getContentTaxonomy(),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-8 sm:px-8 sm:pt-10">
      <div className="max-w-2xl">
        <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
          Prompt Submission · 投稿
        </p>
        <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">
          提交一组作品
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">
          把真正值得复用的图片和提示词留在焚诀。提交后会进入审核，通过后公开展示。
        </p>
      </div>

      <PromptEditor
        categories={taxonomy.categories}
        defaultAuthorName={
          profile?.display_name || user.user_metadata?.display_name || ""
        }
        tags={taxonomy.tags}
      />
    </main>
  );
}
