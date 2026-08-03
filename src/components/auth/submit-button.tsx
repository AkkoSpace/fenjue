"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

interface SubmitButtonProps {
  children: React.ReactNode;
  pendingLabel: string;
}

export function SubmitButton({ children, pendingLabel }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      className="min-h-11 w-full rounded-sm px-4"
      disabled={pending}
      size="lg"
      type="submit"
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
      ) : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}
