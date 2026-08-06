"use client";

import { Trash2 } from "lucide-react";

import { ActionButton } from "@/components/admin/action-button";
import { deletePrompt } from "@/lib/admin/actions";

interface DeletePromptFormProps {
  canDelete: boolean;
  id: string;
  returnTo: string;
  title: string;
}

export function DeletePromptForm({
  canDelete,
  id,
  returnTo,
  title,
}: DeletePromptFormProps) {
  return (
    <form
      action={deletePrompt}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `确定永久删除《${title}》吗？数据库记录和 R2 图片都会被删除，此操作无法撤销。`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input name="id" type="hidden" value={id} />
      <input name="returnTo" type="hidden" value={returnTo} />
      <ActionButton
        aria-label={`永久删除《${title}》`}
        className="min-h-11 rounded-sm sm:min-h-9"
        disabled={!canDelete}
        pendingLabel="删除中"
        size="sm"
        title={canDelete ? undefined : "完成 R2 写入配置后才能永久删除"}
        type="submit"
        variant="destructive"
      >
        <Trash2 data-icon="inline-start" aria-hidden="true" />
        删除
      </ActionButton>
    </form>
  );
}
