import Link from "next/link";

import { PageShell } from "@/components/layout/page-shell";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  children: React.ReactNode;
  description: string;
  eyebrow: string;
  message?: {
    kind: "error" | "success" | "warning";
    text: string;
  };
  title: string;
  variant?: "account" | "auth";
}

export function AuthShell({
  children,
  description,
  eyebrow,
  message,
  title,
  variant = "auth",
}: AuthShellProps) {
  const accountLayout = variant === "account";

  return (
    <PageShell className="flex flex-1 py-10 sm:py-14">
      <div
        className={cn(
          "grid w-full gap-10 lg:gap-16 xl:gap-24",
          accountLayout
            ? "lg:grid-cols-[minmax(16rem,0.42fr)_minmax(0,0.92fr)]"
            : "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]",
        )}
      >
        <div
          className={cn(
            "max-w-2xl border-t border-border/80 pt-5",
            accountLayout && "lg:sticky lg:top-24 lg:self-start",
          )}
        >
          <p className="text-xs font-medium tracking-[0.2em] text-primary uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-4xl leading-tight text-foreground sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
            {description}
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex min-h-11 items-center text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            返回作品流
          </Link>
        </div>

        <section className="border-t border-foreground/20 pt-5" aria-label={title}>
          {message ? (
            <p
              className={
                message.kind === "error"
                  ? "mb-5 border-l-2 border-destructive bg-destructive/6 px-3 py-2.5 text-sm leading-6 text-destructive"
                  : message.kind === "warning"
                    ? "mb-5 border-l-2 border-amber-600 bg-amber-600/6 px-3 py-2.5 text-sm leading-6 text-foreground"
                    : "mb-5 border-l-2 border-primary bg-primary/6 px-3 py-2.5 text-sm leading-6 text-foreground"
              }
              role={message.kind === "error" ? "alert" : "status"}
            >
              {message.text}
            </p>
          ) : null}
          {children}
        </section>
      </div>
    </PageShell>
  );
}

export function AuthShellFallback({
  variant = "auth",
}: Readonly<{ variant?: "account" | "auth" }>) {
  const accountLayout = variant === "account";

  return (
    <PageShell
      className="flex flex-1 py-10 sm:py-14"
      aria-label="正在载入账户页面"
    >
      <div
        className={cn(
          "grid w-full gap-10 lg:gap-16 xl:gap-24",
          accountLayout
            ? "lg:grid-cols-[minmax(16rem,0.42fr)_minmax(0,0.92fr)]"
            : "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,28rem)]",
        )}
      >
        <div className="max-w-2xl border-t border-border/80 pt-5">
          <div className="h-3 w-28 animate-pulse bg-muted motion-reduce:animate-none" />
          <div className="mt-5 h-12 w-48 animate-pulse bg-muted motion-reduce:animate-none" />
          <div className="mt-5 h-20 max-w-xl animate-pulse bg-muted motion-reduce:animate-none" />
        </div>
        <div className="space-y-5 border-t border-foreground/20 pt-5">
          <div className="h-16 animate-pulse bg-muted motion-reduce:animate-none" />
          <div className="h-16 animate-pulse bg-muted motion-reduce:animate-none" />
          <div className="h-11 animate-pulse bg-muted motion-reduce:animate-none" />
        </div>
      </div>
    </PageShell>
  );
}
