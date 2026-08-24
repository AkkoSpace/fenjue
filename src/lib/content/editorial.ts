import type { AiTool } from "@/lib/content/ai-tools";
import type { PromptReviewStatus } from "@/lib/content/review";
import type { PromptCardData, PromptImage } from "@/lib/content/types";

export interface PromptFeature {
  position: number;
  recommendation: string;
}

export interface PromptCollectionLink {
  id: string;
  position: number;
  slug: string;
  title: string;
}

export interface FeaturedPrompt {
  entry: PromptCardData;
  position: number;
  recommendation: string;
}

export interface PromptCollectionSummary {
  cover?: PromptImage;
  description: string;
  id: string;
  promptCount: number;
  slug: string;
  sortOrder: number;
  title: string;
  updatedAt: string;
}

export interface PromptCollectionDetail extends PromptCollectionSummary {
  entries: PromptCardData[];
}

export interface PromptComment {
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  isOwn: boolean;
  reviewNote: string | null;
  reviewStatus: PromptReviewStatus;
  tool: AiTool | null;
}

export const MAX_COMMENT_LENGTH = 500;
export const MIN_COMMENT_LENGTH = 10;
export const MAX_COLLECTIONS_PER_PROMPT = 20;
