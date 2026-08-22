import type { MetadataRoute } from "next";
import { connection } from "next/server";

import {
  getContentTaxonomy,
  getPromptSitemapEntries,
} from "@/lib/content/queries";
import { getPublishedCollections } from "@/lib/content/editorial-queries";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();

  const [taxonomy, prompts, collections] = await Promise.all([
    getContentTaxonomy(),
    getPromptSitemapEntries(),
    getPublishedCollections(),
  ]);

  return [
    {
      changeFrequency: "daily",
      priority: 1,
      url: absoluteUrl("/"),
    },
    {
      changeFrequency: "weekly",
      priority: 0.8,
      url: absoluteUrl("/collections"),
    },
    ...collections.map((collection) => ({
      changeFrequency: "weekly" as const,
      lastModified: collection.updatedAt,
      priority: 0.7,
      url: absoluteUrl(`/collections/${collection.slug}`),
    })),
    ...taxonomy.categories.map((category) => ({
      changeFrequency: "daily" as const,
      priority: 0.8,
      url: absoluteUrl(`/?category=${encodeURIComponent(category.key)}`),
    })),
    ...taxonomy.tags.map((tag) => ({
      changeFrequency: "daily" as const,
      priority: 0.7,
      url: absoluteUrl(`/?tag=${encodeURIComponent(tag.key)}`),
    })),
    ...prompts.map((prompt) => ({
      changeFrequency: "monthly" as const,
      lastModified: prompt.lastModified,
      priority: 0.6,
      url: absoluteUrl(`/prompts/${prompt.slug}`),
    })),
  ];
}
