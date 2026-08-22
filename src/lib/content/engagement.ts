export const PROMPT_REACTION_LEVELS = [
  "tian",
  "di",
  "xuan",
  "huang",
] as const;

export type PromptReactionLevel = (typeof PROMPT_REACTION_LEVELS)[number];

export const PROMPT_REACTION_META: Record<
  PromptReactionLevel,
  { description: string; label: string; shortLabel: string }
> = {
  tian: {
    description: "第一眼足够惊艳，很想收藏与复用",
    label: "天阶",
    shortLabel: "天",
  },
  di: {
    description: "观感出众、完成度高，值得推荐",
    label: "地阶",
    shortLabel: "地",
  },
  xuan: {
    description: "效果鲜明，让人产生尝试意愿",
    label: "玄阶",
    shortLabel: "玄",
  },
  huang: {
    description: "效果成立，具有基础参考价值",
    label: "黄阶",
    shortLabel: "黄",
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
