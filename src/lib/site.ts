const DEFAULT_SITE_URL = "https://fenjue.akko.space";

export const SITE_NAME = "焚诀";
export const SITE_DESCRIPTION =
  "精选 AI 文生图提示词与参考图片，支持 Nano Banana、豆包、ChatGPT、Grok 等生成工具。";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  try {
    return new URL(configuredUrl || DEFAULT_SITE_URL);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export function absoluteUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}
