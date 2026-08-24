export const PROMPT_REACTION_LEVELS = [
  "tian",
  "di",
  "xuan",
  "huang",
] as const;

export type PromptReactionLevel = (typeof PROMPT_REACTION_LEVELS)[number];

export const PROMPT_REACTION_META: Record<
  PromptReactionLevel,
  { description: string; emoji: string; label: string }
> = {
  tian: {
    description: "画面一下点燃灵感，值得马上收藏复用",
    emoji: "🔥",
    label: "灵感燃了",
  },
  di: {
    description: "成片有意外惊喜，视觉表达很出彩",
    emoji: "🪄",
    label: "神来一笔",
  },
  xuan: {
    description: "提示词勾起尝试欲，想复制后亲自生成",
    emoji: "🧪",
    label: "想炼同款",
  },
  huang: {
    description: "提示词或技巧提供了可复用的新思路",
    emoji: "💡",
    label: "学到一招",
  },
};

export interface PromptEngagementMetrics {
  copies: number;
  likes: number;
  reactions: Record<PromptReactionLevel, number>;
  views: number;
}

export interface PromptEngagementUserState {
  liked: boolean;
  reaction: PromptReactionLevel | null;
}

export interface PromptEngagementSnapshot {
  metrics: PromptEngagementMetrics;
  user: PromptEngagementUserState | null;
}

export const EMPTY_PROMPT_ENGAGEMENT: PromptEngagementMetrics = {
  copies: 0,
  likes: 0,
  reactions: {
    di: 0,
    huang: 0,
    tian: 0,
    xuan: 0,
  },
  views: 0,
};

export function isPromptReactionLevel(
  value: unknown,
): value is PromptReactionLevel {
  return PROMPT_REACTION_LEVELS.includes(value as PromptReactionLevel);
}

function count(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : 0;
}

export function normalizePromptEngagementSnapshot(
  value: unknown,
): PromptEngagementSnapshot | null {
  if (!value || typeof value !== "object") return null;

  const root = value as Record<string, unknown>;
  const rawMetrics = root.metrics;
  if (!rawMetrics || typeof rawMetrics !== "object") return null;

  const metrics = rawMetrics as Record<string, unknown>;
  const rawReactions = metrics.reactions;
  const reactions =
    rawReactions && typeof rawReactions === "object"
      ? (rawReactions as Record<string, unknown>)
      : {};
  const rawUser = root.user;
  let user: PromptEngagementUserState | null = null;

  if (rawUser && typeof rawUser === "object") {
    const candidate = rawUser as Record<string, unknown>;
    user = {
      liked: candidate.liked === true,
      reaction: isPromptReactionLevel(candidate.reaction)
        ? candidate.reaction
        : null,
    };
  }

  return {
    metrics: {
      copies: count(metrics.copies),
      likes: count(metrics.likes),
      reactions: {
        di: count(reactions.di),
        huang: count(reactions.huang),
        tian: count(reactions.tian),
        xuan: count(reactions.xuan),
      },
      views: count(metrics.views),
    },
    user,
  };
}
