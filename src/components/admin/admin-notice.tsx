import { cn } from "@/lib/utils";

export type AdminNoticeKind = "error" | "success" | "warning";

export function AdminNotice({
  kind,
  text,
}: {
  kind: AdminNoticeKind;
  text: string;
}) {
  return (
    <div
      className={cn(
        "mt-6 border px-4 py-3 text-sm leading-6",
        kind === "error" &&
          "border-destructive/30 bg-destructive/5 text-destructive",
        kind === "success" &&
          "border-emerald-700/25 bg-emerald-700/5 text-emerald-800",
        kind === "warning" &&
          "border-amber-700/25 bg-amber-700/5 text-amber-900",
      )}
      role={kind === "error" ? "alert" : "status"}
    >
      {text}
    </div>
  );
}

export function firstMessage(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
