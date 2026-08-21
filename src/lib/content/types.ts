import type { AiToolKey } from "@/lib/content/ai-tools";
import type { ContentRelation } from "@/lib/content/relation";
import type {
  TaxonomyCategory,
  TaxonomyTag,
} from "@/lib/content/taxonomy";

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
  category: TaxonomyCategory;
  contentRelation: ContentRelation;
  images: PromptImage[];
  isNsfw: boolean;
  prompt: string;
  slug: string;
  sourceUrl: string;
  tags: TaxonomyTag[];
  title: string;
  verifiedTools: AiToolKey[];
}

export type PromptCardData = Pick<
  PromptEntryData,
  "images" | "isNsfw" | "slug" | "title"
>;
