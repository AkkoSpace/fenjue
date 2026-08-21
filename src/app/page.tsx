import { PromptEntry } from "@/components/prompt-entry";
import { PromptFilters } from "@/components/prompt-filters";
import { getPrompts } from "@/lib/content/queries";

export const instant = false;

interface HomeProps {
  searchParams: Promise<{
    category?: string | string[];
    tag?: string | string[];
  }>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function Home({ searchParams }: HomeProps) {
  const raw = await searchParams;
  const entries = await getPrompts();
  const requestedCategory = first(raw.category);
  const requestedTag = first(raw.tag);
  const activeCategory = entries.some(
    (entry) => entry.category.key === requestedCategory,
  )
    ? requestedCategory
    : undefined;
  const activeTag = entries.some((entry) =>
    entry.tags.some((tag) => tag.key === requestedTag),
  )
    ? requestedTag
    : undefined;
  const filteredEntries = entries.filter(
    (entry) =>
      (!activeCategory || entry.category.key === activeCategory) &&
      (!activeTag || entry.tags.some((tag) => tag.key === activeTag)),
  );
  const categoryMap = new Map<
    string,
    { count: number; key: string; name: string; sortOrder: number }
  >();
  const tagMap = new Map<
    string,
    { count: number; key: string; name: string; sortOrder: number }
  >();
  const categoryEntries = activeTag
    ? entries.filter((entry) =>
        entry.tags.some((tag) => tag.key === activeTag),
      )
    : entries;
  const tagEntries = activeCategory
    ? entries.filter((entry) => entry.category.key === activeCategory)
    : entries;

  for (const entry of categoryEntries) {
    const category = categoryMap.get(entry.category.key);
    categoryMap.set(entry.category.key, {
      count: (category?.count ?? 0) + 1,
      ...entry.category,
    });
  }

  for (const entry of tagEntries) {
    for (const tag of entry.tags) {
      const current = tagMap.get(tag.key);
      tagMap.set(tag.key, {
        count: (current?.count ?? 0) + 1,
        key: tag.key,
        name: tag.name,
        sortOrder: tag.sortOrder,
      });
    }
  }
  const categories = [...categoryMap.values()].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );
  const tags = [...tagMap.values()].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  );

  return (
    <main className="mx-auto w-full max-w-[90rem] px-5 pb-20 pt-8 sm:px-8 sm:pt-10">
      <div className="mb-9 max-w-2xl sm:mb-11">
        <p className="mb-2 text-xs font-medium tracking-[0.2em] text-primary uppercase">
          Prompt Collection · 01
        </p>
        <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-4xl">
          文生图
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
          看见喜欢的画面，复制提示词，去你常用的 AI 工具里重新生成。
        </p>
      </div>

      <PromptFilters
        activeCategory={activeCategory}
        activeTag={activeTag}
        categories={categories}
        categoryAllCount={categoryEntries.length}
        filteredCount={filteredEntries.length}
        tagAllCount={tagEntries.length}
        tags={tags}
      />

      <section
        aria-label="精选文生图提示词"
        className="columns-1 gap-6 md:columns-2 2xl:columns-3"
      >
        {filteredEntries.length ? (
          filteredEntries.map((entry) => (
            <PromptEntry key={entry.slug} entry={entry} />
          ))
        ) : (
          <div className="break-inside-avoid border-y border-border py-16 text-center">
            <h2 className="font-serif text-xl text-foreground">没有符合条件的作品</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              试试其他分类或标签，也可以清除当前筛选。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
