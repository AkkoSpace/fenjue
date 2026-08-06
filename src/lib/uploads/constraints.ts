export const MAX_PROMPT_IMAGES = 8;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export const IMAGE_TYPES = {
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type SupportedImageType = keyof typeof IMAGE_TYPES;

export function isSupportedImageType(
  contentType: string,
): contentType is SupportedImageType {
  return contentType in IMAGE_TYPES;
}

