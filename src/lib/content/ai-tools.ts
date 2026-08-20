export const AI_TOOL_OPTIONS = [
  { label: "Nano Banana", value: "nano-banana" },
  { label: "豆包", value: "doubao" },
  { label: "Grok", value: "grok" },
  { label: "ChatGPT", value: "chatgpt" },
] as const;

export type AiToolKey = (typeof AI_TOOL_OPTIONS)[number]["value"];

export function isAiToolKey(value: unknown): value is AiToolKey {
  return AI_TOOL_OPTIONS.some((option) => option.value === value);
}

export function getAiToolOption(value: AiToolKey) {
  return AI_TOOL_OPTIONS.find((option) => option.value === value)!;
}

export function normalizeAiToolKeys(value: unknown): AiToolKey[] {
  if (!Array.isArray(value)) return [];

  const selected = new Set(value.filter(isAiToolKey));
  return AI_TOOL_OPTIONS.filter((option) => selected.has(option.value)).map(
    (option) => option.value,
  );
}
