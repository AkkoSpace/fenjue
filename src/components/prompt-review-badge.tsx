import type { PromptReviewStatus } from "@/lib/content/review";
import { PROMPT_REVIEW_STATUS_META } from "@/lib/content/review";
import { cn } from "@/lib/utils";

const statusClassName: Record<PromptReviewStatus, string> = {
  approved: "border-emerald-700/25 bg-emerald-700/5 text-emerald-800",
  pending: "border-amber-700/25 bg-amber-700/5 text-amber-900",
  rejected: "border-destructive/25 bg-destructive/5 text-destructive",
};

export function PromptReviewBadge({
  className,
  status,
}: {
  className?: string;
  status: PromptReviewStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center border px-2 text-xs font-medium",
        statusClassName[status],
        className,
      )}
    >
      {PROMPT_REVIEW_STATUS_META[status].label}
    </span>
  );
}
