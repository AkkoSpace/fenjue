export const PROMPT_REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export type PromptReviewStatus = (typeof PROMPT_REVIEW_STATUSES)[number];

export const PROMPT_REVIEW_STATUS_META: Record<
  PromptReviewStatus,
  { description: string; label: string }
> = {
  approved: {
    description: "审核通过，已在公开作品流中展示。",
    label: "已通过",
  },
  pending: {
    description: "等待管理员检查内容、来源与图片。",
    label: "待审核",
  },
  rejected: {
    description: "暂未通过审核，可根据原因修改后重新提交。",
    label: "已驳回",
  },
};

export function isPromptReviewStatus(
  value: unknown,
): value is PromptReviewStatus {
  return PROMPT_REVIEW_STATUSES.includes(value as PromptReviewStatus);
}
