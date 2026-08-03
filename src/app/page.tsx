import { PromptEntry } from "@/components/prompt-entry";
import { getPrompts } from "@/lib/content/queries";

export default async function Home() {
  const entries = await getPrompts();

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

      <section
        aria-label="精选文生图提示词"
        className="columns-1 gap-6 md:columns-2 2xl:columns-3"
      >
        {entries.map((entry) => (
          <PromptEntry key={entry.slug} entry={entry} />
        ))}
      </section>
    </main>
  );
}
