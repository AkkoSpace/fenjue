"use client";

import {
  FolderTree,
  Gauge,
  Images,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", icon: Gauge, label: "总览" },
  { href: "/admin/content", icon: Images, label: "内容管理" },
  { href: "/admin/users", icon: Users, label: "用户管理" },
  { href: "/admin/taxonomy", icon: FolderTree, label: "分类管理" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="后台管理" className="min-w-0">
      <div className="flex gap-1 overflow-x-auto border-y border-border py-2 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:border-y-0 lg:py-0">
        {ITEMS.map((item) => {
          const active =
            item.href === "/admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center gap-3 rounded-sm px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden="true" className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
