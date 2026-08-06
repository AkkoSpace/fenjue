"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

interface ActionButtonProps extends React.ComponentProps<typeof Button> {
  pendingLabel: string;
}

export function ActionButton({
  children,
  disabled,
  pendingLabel,
  ...props
}: ActionButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
