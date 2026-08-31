import type { AiTool } from "@/lib/content/ai-tools";
import type { SourcePlatform } from "@/lib/content/source-platforms";
import type { ContentRelation } from "@/lib/content/relation";
import type { PromptEngagementMetrics } from "@/lib/content/engagement";
import type {
  PromptCollectionLink,
  PromptFeature,
} from "@/lib/content/editorial";
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
  collections: PromptCollectionLink[];
  contentRelation: ContentRelation;
  engagement: PromptEngagementMetrics;
  feature: PromptFeature | null;
  images: PromptImage[];
  isNsfw: boolean;
  publishedAt: string;
  prompt: string;
  slug: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform | null;
  tags: TaxonomyTag[];
  title: string;
  verifiedTools: AiTool[];
}

export type PromptCardData = Pick<
  PromptEntryData,
  "images" | "isNsfw" | "slug" | "title"
>;
