import type { Route } from "next";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function cleanAdminInput(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeAdminReturnTo(value: string) {
  if (!value.startsWith("/admin") || value.startsWith("//")) {
    return "/admin";
  }

  const url = new URL(value, "https://fenjue.local");
  return url.pathname === "/admin" || url.pathname.startsWith("/admin/")
    ? `${url.pathname}${url.search}`
    : "/admin";
}

export function adminMessageUrl(
  returnTo: string,
  kind: "error" | "success" | "warning",
  message: string,
) {
  const url = new URL(safeAdminReturnTo(returnTo), "https://fenjue.local");
  url.searchParams.delete("error");
  url.searchParams.delete("success");
  url.searchParams.delete("warning");
  url.searchParams.set(kind, message);
  return `${url.pathname}?${url.searchParams.toString()}` as Route;
}
