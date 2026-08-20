import type { AiToolKey } from "@/lib/content/ai-tools";
import type { ContentRelation } from "@/lib/content/relation";

export interface PromptImage {
  alt: string;
  height: number;
  objectKey?: string;
  src?: string;
  width: number;
}

export interface PromptAuthor {
  name: string;
  url: string;
}

export interface PromptEntryData {
  author: PromptAuthor;
  contentRelation: ContentRelation;
  images: PromptImage[];
  isNsfw: boolean;
  prompt: string;
  slug: string;
  sourceUrl: string;
  title: string;
  verifiedTools: AiToolKey[];
}
