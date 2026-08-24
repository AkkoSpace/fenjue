"use client";

import { Menu } from "@base-ui/react/menu";
import {
  Copy as CopyIcon,
  Eye,
  Heart,
  SmilePlus,
  Sparkles,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  normalizePromptEngagementSnapshot,
  type PromptEngagementMetrics,
  type PromptEngagementSnapshot,
  PROMPT_REACTION_LEVELS,
  type PromptReactionLevel,
  PROMPT_REACTION_META,
} from "@/lib/content/engagement";
import { cn } from "@/lib/utils";

type PendingAction = "like" | PromptReactionLevel | null;

interface PromptEngagementContextValue extends PromptEngagementSnapshot {
  error: string | null;
  isReady: boolean;
  pending: PendingAction;
  recordCopy: () => Promise<void>;
  showLogin: boolean;
  toggleLike: () => Promise<void>;
  toggleReaction: (reaction: PromptReactionLevel) => Promise<void>;
}

const PromptEngagementContext =
  createContext<PromptEngagementContextValue | null>(null);

class EngagementRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function updateEngagement(
  slug: string,
  action: "copy" | "reaction" | "toggle_like" | "view",
  reaction?: PromptReactionLevel,
) {
  const response = await fetch(`/api/prompts/${slug}/engagement`, {
    body: JSON.stringify({ action, reaction }),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const value = (await response.json()) as unknown;

  if (!response.ok) {
    const message =
      value && typeof value === "object" && "error" in value
        ? String((value as { error: unknown }).error)
        : "互动暂时没有记录成功，请稍后再试。";
    throw new EngagementRequestError(message, response.status);
  }

  const snapshot = normalizePromptEngagementSnapshot(value);
  if (!snapshot) {
    throw new EngagementRequestError("互动数据格式无效。", 502);
  }

  return snapshot;
}

function optimisticReactionMetrics(
  metrics: PromptEngagementMetrics,
  current: PromptReactionLevel | null,
  selected: PromptReactionLevel,
) {
  const next = current === selected ? null : selected;
  const reactions = { ...metrics.reactions };

  if (current) reactions[current] = Math.max(0, reactions[current] - 1);
  if (next) reactions[next] += 1;

  return { metrics: { ...metrics, reactions }, reaction: next };
}

export function PromptEngagementProvider({
  children,
  initialMetrics,
  slug,
}: {
  children: ReactNode;
  initialMetrics: PromptEngagementMetrics;
  slug: string;
}) {
  const [snapshot, setSnapshot] = useState<PromptEngagementSnapshot>({
    metrics: initialMetrics,
    user: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    updateEngagement(slug, "view")
      .then((next) => {
        if (!controller.signal.aborted) setSnapshot(next);
      })
      .catch(() => {
        // Public content remains usable when optional metrics are unavailable.
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsReady(true);
      });

    return () => controller.abort();
  }, [slug]);

  async function recordCopy() {
    try {
      const next = await updateEngagement(slug, "copy");
      setSnapshot(next);
    } catch {
      // Copy success must not be downgraded by optional metric reporting.
    }
  }

  async function toggleLike() {
    if (!isReady || pending) return;
    if (!snapshot.user) {
      setShowLogin(true);
      return;
    }

    const previous = snapshot;
    const liked = !snapshot.user.liked;
    setError(null);
    setPending("like");
    setSnapshot({
      metrics: {
        ...snapshot.metrics,
        likes: Math.max(0, snapshot.metrics.likes + (liked ? 1 : -1)),
      },
      user: { ...snapshot.user, liked },
    });

    try {
      setSnapshot(await updateEngagement(slug, "toggle_like"));
    } catch (caught) {
      setSnapshot(previous);
      if (caught instanceof EngagementRequestError && caught.status === 401) {
        setShowLogin(true);
      } else {
        setError(caught instanceof Error ? caught.message : "喜欢操作失败。");
      }
    } finally {
      setPending(null);
    }
  }

  async function toggleReaction(reaction: PromptReactionLevel) {
    if (!isReady || pending) return;
    if (!snapshot.user) {
      setShowLogin(true);
      return;
    }

    const previous = snapshot;
    const optimistic = optimisticReactionMetrics(
      snapshot.metrics,
      snapshot.user.reaction,
      reaction,
    );
    setError(null);
    setPending(reaction);
    setSnapshot({
      metrics: optimistic.metrics,
      user: { ...snapshot.user, reaction: optimistic.reaction },
    });

    try {
      setSnapshot(await updateEngagement(slug, "reaction", reaction));
    } catch (caught) {
      setSnapshot(previous);
      if (caught instanceof EngagementRequestError && caught.status === 401) {
        setShowLogin(true);
      } else {
        setError(caught instanceof Error ? caught.message : "回应没有记录成功。");
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <PromptEngagementContext.Provider
      value={{
        ...snapshot,
        error,
        isReady,
        pending,
        recordCopy,
        showLogin,
        toggleLike,
        toggleReaction,
      }}
    >
      {children}
    </PromptEngagementContext.Provider>
  );
}

export function usePromptEngagement() {
  return useContext(PromptEngagementContext);
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Eye;
  label: string;
  value: number;
}) {
  return (
    <div className="flex min-h-11 items-center gap-2">
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium tabular-nums text-foreground">
        {value.toLocaleString("zh-CN")}
      </span>
    </div>
  );
}

function ReactionMenuItem({
  engagement,
  reaction,
}: {
  engagement: PromptEngagementContextValue;
  reaction: PromptReactionLevel;
}) {
  const meta = PROMPT_REACTION_META[reaction];
  const selected = engagement.user?.reaction === reaction;

  return (
    <Menu.Item
      aria-label={`${meta.label}：${meta.description}`}
      aria-pressed={selected}
      className={cn(
        "grid size-12 place-items-center rounded-sm text-[1.35rem] outline-none transition-[background-color,transform] duration-150 data-highlighted:bg-muted active:scale-[0.94] motion-reduce:transition-none",
        selected && "bg-primary/10 ring-1 ring-inset ring-primary/45",
      )}
      closeOnClick
      nativeButton
      onClick={() => engagement.toggleReaction(reaction)}
      render={
        <button
          title={`${meta.label}：${meta.description}`}
          type="button"
        />
      }
    >
      <span aria-hidden="true">{meta.emoji}</span>
    </Menu.Item>
  );
}

function ReactionMenu({
  disabled,
  engagement,
}: {
  disabled: boolean;
  engagement: PromptEngagementContextValue;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="添加作品回应"
        className="group grid size-11 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground outline-none transition-[border-color,color,transform,background-color] duration-150 hover:border-primary/60 hover:bg-primary/5 hover:text-primary active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring data-popup-open:border-primary/60 data-popup-open:bg-primary/5 data-popup-open:text-primary disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none"
        disabled={disabled}
      >
        <SmilePlus aria-hidden="true" className="size-5" />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner
          align="start"
          className="z-50 outline-none"
          collisionPadding={16}
          side="top"
          sideOffset={8}
        >
          <Menu.Popup
            aria-label="选择作品回应"
            className="origin-[var(--transform-origin)] rounded-sm border border-border bg-popover p-1.5 text-popover-foreground shadow-[0_18px_50px_-24px_oklch(0.24_0.018_70/0.45)] outline-none transition-[transform,opacity] duration-150 data-closed:scale-[0.98] data-closed:opacity-0 data-open:scale-100 data-open:opacity-100 data-starting-style:scale-[0.98] data-starting-style:opacity-0 motion-reduce:transition-none"
          >
            <div className="grid grid-cols-4 gap-1">
              {PROMPT_REACTION_LEVELS.map((reaction) => (
                <ReactionMenuItem
                  engagement={engagement}
                  key={reaction}
                  reaction={reaction}
                />
              ))}
            </div>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function ReactionPill({
  disabled,
  engagement,
  reaction,
}: {
  disabled: boolean;
  engagement: PromptEngagementContextValue;
  reaction: PromptReactionLevel;
}) {
  const meta = PROMPT_REACTION_META[reaction];
  const count = engagement.metrics.reactions[reaction];
  const selected = engagement.user?.reaction === reaction;

  return (
    <button
      aria-label={`${meta.label}，${count} 人回应。${selected ? "再次点击取消" : "点击选择"}`}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-sm tabular-nums text-foreground outline-none transition-[border-color,color,transform,background-color] duration-150 hover:border-primary/55 hover:bg-primary/5 hover:text-primary active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
        selected && "border-primary/55 bg-primary/8 text-primary",
      )}
      disabled={disabled}
      onClick={() => engagement.toggleReaction(reaction)}
      title={`${meta.label}：${meta.description}`}
      type="button"
    >
      <span aria-hidden="true" className="text-base leading-none">
        {meta.emoji}
      </span>
      <span>{count.toLocaleString("zh-CN")}</span>
    </button>
  );
}

function ReactionPicker({
  engagement,
  total,
}: {
  engagement: PromptEngagementContextValue;
  total: number;
}) {
  const populatedReactions = PROMPT_REACTION_LEVELS.filter(
    (reaction) => engagement.metrics.reactions[reaction] > 0,
  );
  const disabled = !engagement.isReady || engagement.pending !== null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:justify-end">
      <ReactionMenu disabled={disabled} engagement={engagement} />
      {populatedReactions.map((reaction) => (
        <ReactionPill
          disabled={disabled}
          engagement={engagement}
          key={reaction}
          reaction={reaction}
        />
      ))}

      <span className="min-h-11 content-center text-sm text-muted-foreground tabular-nums">
        {total > 0
          ? `${total.toLocaleString("zh-CN")} 人回应`
          : "等待第一份回应"}
      </span>
    </div>
  );
}

export function PromptEngagementBar({ slug }: { slug: string }) {
  const engagement = usePromptEngagement();
  if (!engagement) return null;

  const reactionTotal = Object.values(engagement.metrics.reactions).reduce(
    (total, count) => total + count,
    0,
  );
  const loginHref = `/login?next=${encodeURIComponent(`/prompts/${slug}`)}` as Route;

  return (
    <section
      aria-label="作品互动"
      className="mt-6 border-y border-border/80 py-4 sm:mt-8 sm:py-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-x-5">
          <Metric icon={Eye} label="浏览" value={engagement.metrics.views} />
          <Metric
            icon={CopyIcon}
            label="复制"
            value={engagement.metrics.copies}
          />
          <Metric icon={Sparkles} label="回应" value={reactionTotal} />
        </div>

        <Button
          aria-pressed={engagement.user?.liked ?? false}
          className={cn(
            "min-h-11 min-w-28 rounded-sm tabular-nums",
            engagement.user?.liked && "border-primary text-primary",
          )}
          disabled={!engagement.isReady || engagement.pending !== null}
          onClick={engagement.toggleLike}
          type="button"
          variant="outline"
        >
          <Heart
            aria-hidden="true"
            className={cn(engagement.user?.liked && "fill-current")}
          />
          喜欢 {engagement.metrics.likes.toLocaleString("zh-CN")}
        </Button>
      </div>

      <div className="mt-4 border-t border-border/70 pt-4 sm:flex sm:items-center sm:justify-between sm:gap-8">
        <div className="max-w-md">
          <h2 className="font-serif text-lg text-foreground">回应此诀</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            选一个最贴近你的感受；再次点击可以取消。
          </p>
        </div>
        <ReactionPicker engagement={engagement} total={reactionTotal} />
      </div>

      <div aria-live="polite" className="mt-3 min-h-5 text-xs">
        {engagement.showLogin ? (
          <p className="text-muted-foreground">
            <Link
              className="font-medium text-primary underline underline-offset-4"
              href={loginHref}
            >
              登录
            </Link>
            后可以喜欢作品并添加回应；浏览和复制始终无需登录。
          </p>
        ) : engagement.error ? (
          <p className="text-destructive">{engagement.error}</p>
        ) : null}
      </div>
    </section>
  );
}
