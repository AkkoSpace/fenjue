import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

type PageShellWidth = "content" | "wide";

const WIDTH_CLASS_NAMES: Record<PageShellWidth, string> = {
  content: "max-w-[90rem]",
  wide: "max-w-[128rem]",
};

interface PageShellProps extends ComponentProps<"main"> {
  width?: PageShellWidth;
}

export function PageShell({
  className,
  width = "content",
  ...props
}: PageShellProps) {
  return (
    <main
      className={cn(
        "mx-auto w-full flex-1 px-5 sm:px-8",
        WIDTH_CLASS_NAMES[width],
        className,
      )}
      {...props}
    />
  );
}
