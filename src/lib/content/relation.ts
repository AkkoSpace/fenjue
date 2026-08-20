export const CONTENT_RELATION_OPTIONS = [
  {
    description: "由所填作者独立创作",
    label: "原创",
    value: "original",
  },
  {
    description: "原样整理原作者内容",
    label: "转载",
    value: "repost",
  },
  {
    description: "经过翻译、改写或重新生成",
    label: "改编",
    value: "adapted",
  },
] as const;

export type ContentRelation = (typeof CONTENT_RELATION_OPTIONS)[number]["value"];

export function isContentRelation(value: unknown): value is ContentRelation {
  return CONTENT_RELATION_OPTIONS.some((option) => option.value === value);
}

export function getContentRelationOption(value: ContentRelation) {
  return CONTENT_RELATION_OPTIONS.find((option) => option.value === value)!;
}
