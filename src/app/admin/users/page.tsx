import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { ActionButton } from "@/components/admin/action-button";
import { AdminNotice, firstMessage } from "@/components/admin/admin-notice";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setUserRole } from "@/lib/admin/user-actions";
import {
  type AdminUserSearchParams,
  getAdminUsers,
} from "@/lib/admin/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  description: "查看焚诀用户与管理员角色。",
  title: { absolute: "用户管理｜焚诀" },
};

interface UsersPageProps {
  searchParams: Promise<
    AdminUserSearchParams & {
      error?: string | string[];
      success?: string | string[];
    }
  >;
}

const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "medium",
});

function usersHref(page = 1, query = "") {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return `/admin/users${search ? `?${search}` : ""}` as Route;
}

function UsersFallback() {
  return <main><div className="h-24 animate-pulse bg-muted/40" /><div className="mt-8 h-96 animate-pulse bg-muted/30" /></main>;
}

export default function AdminUsersPage(props: UsersPageProps) {
  return <Suspense fallback={<UsersFallback />}><UsersContent {...props} /></Suspense>;
}

async function UsersContent({ searchParams }: UsersPageProps) {
  const raw = await searchParams;
  const data = await getAdminUsers(raw);
  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const returnTo = usersHref(data.page, data.query);
  const error = firstMessage(raw.error);
  const success = firstMessage(raw.success);
  const canManageRoles = data.profile.is_super_admin;

  return (
    <main>
      <AdminPageHeader
        description="查看注册、邮箱验证和最近登录状态；管理员角色只能由唯一超级管理员调整。"
        eyebrow="Accounts · 用户"
        title="用户管理"
      />
      {error ? <AdminNotice kind="error" text={error} /> : null}
      {success ? <AdminNotice kind="success" text={success} /> : null}
      {data.error ? <AdminNotice kind="error" text={data.error} /> : null}

      <section aria-labelledby="users-heading" className="mt-8">
        <div className="flex flex-col gap-4 border-y border-border py-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-muted-foreground">
            共 <span className="font-medium text-foreground">{data.total}</span> 个账户
          </p>
          <form className="flex w-full gap-2 md:max-w-md" method="get">
            <div className="relative min-w-0 flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="搜索用户" className="pl-9" defaultValue={data.query} maxLength={80} name="q" placeholder="邮箱或昵称" type="search" />
            </div>
            <Button className="min-h-11 rounded-sm" type="submit" variant="outline">搜索</Button>
            {data.query ? (
              <Link aria-label="清除搜索" className={cn(buttonVariants({ size: "icon", variant: "ghost" }), "size-11 rounded-sm")} href="/admin/users" title="清除搜索"><RotateCcw aria-hidden="true" /></Link>
            ) : null}
          </form>
        </div>
        <h2 className="sr-only" id="users-heading">用户列表</h2>

        {data.items.length ? (
          <div className="divide-y divide-border border-b border-border">
            {data.items.map((user) => (
              <article className="grid gap-4 py-5 md:grid-cols-[minmax(0,1.2fr)_minmax(10rem,0.65fr)_minmax(9rem,0.55fr)_auto] md:items-center md:gap-6" key={user.id}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", user.isSuperAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {user.isSuperAdmin || user.role === "admin" ? <ShieldCheck aria-hidden="true" className="size-4" /> : <UserRound aria-hidden="true" className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-medium">{user.displayName || "未设置昵称"}</h3>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <div>
                  <p className="flex items-center gap-2 text-sm">
                    {user.emailConfirmedAt ? <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-700" /> : <span aria-hidden="true" className="size-2 rounded-full bg-amber-600" />}
                    {user.emailConfirmedAt ? "邮箱已验证" : "等待验证"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">注册于 {dateFormatter.format(new Date(user.createdAt))}</p>
                </div>

                <div>
                  <p className="text-sm">{user.isSuperAdmin ? "超级管理员" : user.role === "admin" ? "管理员" : "普通用户"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{user.lastSignInAt ? `最近登录 ${dateFormatter.format(new Date(user.lastSignInAt))}` : "尚未登录"}</p>
                </div>

                <div className="md:justify-self-end">
                  {user.isSuperAdmin ? (
                    <span className="inline-flex min-h-9 items-center text-xs text-muted-foreground">唯一超管 · 不可变更</span>
                  ) : canManageRoles ? (
                    <form action={setUserRole}>
                      <input name="id" type="hidden" value={user.id} />
                      <input name="role" type="hidden" value={user.role === "admin" ? "user" : "admin"} />
                      <input name="returnTo" type="hidden" value={returnTo} />
                      <ActionButton className="min-h-11 rounded-sm sm:min-h-9" pendingLabel="处理中" size="sm" type="submit" variant="outline">
                        {user.role === "admin" ? "撤销管理员" : "设为管理员"}
                      </ActionButton>
                    </form>
                  ) : (
                    <span className="text-xs text-muted-foreground">仅超管可调整</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="border-b border-border py-16 text-center"><UserRound aria-hidden="true" className="mx-auto size-6 text-muted-foreground" /><p className="mt-4 text-sm text-muted-foreground">没有符合条件的用户。</p></div>
        )}

        {totalPages > 1 ? (
          <nav aria-label="用户分页" className="mt-6 flex items-center justify-between border-t border-border pt-5">
            {data.page > 1 ? <Link className={cn(buttonVariants({ variant: "outline" }), "min-h-11 rounded-sm")} href={usersHref(data.page - 1, data.query)}><ArrowLeft aria-hidden="true" />上一页</Link> : <span />}
            <span className="text-sm tabular-nums text-muted-foreground">{data.page} / {totalPages}</span>
            {data.page < totalPages ? <Link className={cn(buttonVariants({ variant: "outline" }), "min-h-11 rounded-sm")} href={usersHref(data.page + 1, data.query)}>下一页<ArrowRight aria-hidden="true" /></Link> : <span />}
          </nav>
        ) : null}
      </section>
    </main>
  );
}
