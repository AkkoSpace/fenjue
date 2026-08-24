import Link from "next/link";

interface AuthShellProps {
  children: React.ReactNode;
  description: string;
  eyebrow: string;
  message?: {
    kind: "error" | "success" | "warning";
    text: string;
  };
  title: string;
}

export function AuthShell({
  children,
  description,
  eyebrow,
  message,
  title,
}: AuthShellProps) {
  return (
    <main className="mx-auto flex w-full max-w-[90rem] flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(20rem,0.38fr)] lg:gap-20">
        <div className="max-w-2xl border-t border-border/80 pt-5">
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
    </main>
  );
}

export function AuthShellFallback() {
  return (
    <main
      className="mx-auto flex w-full max-w-[90rem] flex-1 px-5 py-10 sm:px-8 sm:py-14"
      aria-label="正在载入账户页面"
    >
      <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,0.72fr)_minmax(20rem,0.38fr)] lg:gap-20">
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
    </main>
  );
}
