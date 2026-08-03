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
  images: PromptImage[];
  prompt: string;
  slug: string;
  sourceUrl: string;
  title: string;
}
