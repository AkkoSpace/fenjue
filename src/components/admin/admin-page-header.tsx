import type { ReactNode } from "react";

export function AdminPageHeader({
  action,
  description,
  eyebrow,
  title,
}: {
  action?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-5 border-b border-border pb-6 md:flex-row md:items-end">
      <div className="max-w-3xl">
        <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
          {eyebrow}
        </p>
        <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
