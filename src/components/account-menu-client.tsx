"use client";

import { Menu } from "@base-ui/react/menu";
import {
  ChevronDown,
  LogOut,
  ShieldCheck,
  Upload,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { signOut } from "@/lib/auth/actions";

interface AccountMenuClientProps {
  avatarText: string;
  displayName: string;
  email: string;
  identity: string;
  isAdmin: boolean;
}

const menuItemClassName =
  "flex min-h-11 w-full items-center gap-3 px-4 text-left text-sm text-foreground outline-none transition-colors data-highlighted:bg-muted data-highlighted:text-primary focus-visible:outline-none";

function AvatarMark({ large = false, text }: { large?: boolean; text: string }) {
  return (
    <span
      aria-hidden="true"
      className={
        large
          ? "grid size-11 shrink-0 place-items-center border border-primary/70 bg-primary/5 font-serif text-lg text-primary"
          : "grid size-8 shrink-0 place-items-center border border-primary/70 bg-primary/5 font-serif text-sm text-primary"
      }
    >
      {text}
    </span>
  );
}

function AccountIdentity({
  avatarText,
  displayName,
  email,
  identity,
}: Omit<AccountMenuClientProps, "isAdmin">) {
  return (
    <div className="relative flex gap-3 border-b border-border/80 px-4 py-4">
      <span
        aria-hidden="true"
        className="absolute inset-y-3 left-0 w-0.5 bg-primary"
      />
      <AvatarMark large text={avatarText} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="truncate font-medium text-foreground">{displayName}</p>
          <span className="shrink-0 border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[0.65rem] tracking-[0.08em] text-primary">
            {identity}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {email}
        </p>
      </div>
    </div>
  );
}

function AccountLink({
  code,
  href,
  icon: Icon,
  label,
}: {
  code: string;
  href: string;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <Menu.LinkItem
      className={menuItemClassName}
      closeOnClick
      href={href}
    >
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <span className="font-mono text-[0.65rem] tracking-wider text-muted-foreground">
        {code}
      </span>
    </Menu.LinkItem>
  );
}

function AccountLinks({ isAdmin }: Pick<AccountMenuClientProps, "isAdmin">) {
  return (
    <div className="py-1.5">
      <AccountLink code="ACCOUNT" href="/account" icon={UserRound} label="我的账户" />
      <AccountLink code="SUBMIT" href="/submit" icon={Upload} label="发布作品" />
      {isAdmin ? (
        <AccountLink code="ADMIN" href="/admin" icon={ShieldCheck} label="管理后台" />
      ) : null}
    </div>
  );
}

function SignOutItem() {
  return (
    <div className="border-t border-border/80 py-1.5">
      <form action={signOut}>
        <Menu.Item
          className={`${menuItemClassName} text-muted-foreground data-highlighted:text-destructive`}
          nativeButton
          render={<button type="submit" />}
        >
          <LogOut className="size-4" aria-hidden="true" />
          退出登录
        </Menu.Item>
      </form>
    </div>
  );
}

export function AccountMenuClient({
  avatarText,
  displayName,
  email,
  identity,
  isAdmin,
}: AccountMenuClientProps) {
  return (
    <Menu.Root>
      <Menu.Trigger className="group inline-flex min-h-11 max-w-48 items-center gap-2 px-1 text-foreground outline-none transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring data-popup-open:text-primary">
        <AvatarMark text={avatarText} />
        <span className="hidden max-w-28 truncate text-sm lg:block">
          {displayName}
        </span>
        <ChevronDown
          className="hidden size-3.5 transition-transform duration-200 group-data-popup-open:rotate-180 sm:block motion-reduce:transition-none"
          aria-hidden="true"
        />
        <span className="sr-only">打开账户菜单</span>
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          align="end"
          className="z-50 outline-none"
          collisionPadding={16}
          side="bottom"
          sideOffset={8}
        >
          <Menu.Popup className="w-[min(20rem,calc(100vw-2rem))] origin-[var(--transform-origin)] overflow-hidden rounded-sm border border-border bg-popover text-popover-foreground shadow-[0_18px_50px_-24px_oklch(0.24_0.018_70/0.45)] outline-none transition-[transform,opacity] duration-150 data-closed:scale-[0.98] data-closed:opacity-0 data-open:scale-100 data-open:opacity-100 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none">
            <AccountIdentity
              avatarText={avatarText}
              displayName={displayName}
              email={email}
              identity={identity}
            />
            <AccountLinks isAdmin={isAdmin} />
            <SignOutItem />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
