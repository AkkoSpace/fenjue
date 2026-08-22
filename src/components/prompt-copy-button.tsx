"use client";

import { Check, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { usePromptEngagement } from "@/components/prompt-engagement";

type CopyState = "idle" | "copied" | "error";

interface PromptCopyButtonProps {
  prompt: string;
}

export function PromptCopyButton({ prompt }: PromptCopyButtonProps) {
  const engagement = usePromptEngagement();
  const [state, setState] = useState<CopyState>("idle");
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setState("copied");
      void engagement?.recordCopy();
    } catch {
      setState("error");
    }

    if (resetTimer.current) {
      clearTimeout(resetTimer.current);
    }

    resetTimer.current = setTimeout(() => setState("idle"), 2200);
  }

  const content = {
    copied: {
      icon: Check,
      label: "已复制",
    },
    error: {
      icon: TriangleAlert,
      label: "复制失败",
    },
    idle: {
      icon: Copy,
      label: "复制提示词",
    },
  }[state];
  const Icon = content.icon;

  return (
    <Button
      type="button"
      variant={state === "copied" ? "secondary" : "outline"}
      size="lg"
      onClick={copyPrompt}
      className="min-h-11 min-w-32 border-foreground/20 bg-background px-4 text-foreground shadow-none transition-colors hover:border-primary/40 hover:bg-accent"
      aria-live="polite"
    >
      <Icon data-icon="inline-start" aria-hidden="true" />
      {content.label}
    </Button>
  );
}
