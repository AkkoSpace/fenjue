"use client";

import {
  ArrowLeft,
  ArrowRight,
  ImagePlus,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ContentRelationSelector } from "@/components/submission/content-relation-selector";
import { TaxonomySelector } from "@/components/submission/taxonomy-selector";
import { VerifiedToolsSelector } from "@/components/submission/verified-tools-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  publishPrompt,
  type PublishPromptImageInput,
} from "@/lib/content/actions";
import type { AiTool, AiToolKey } from "@/lib/content/ai-tools";
import type { ContentRelation } from "@/lib/content/relation";
import type {
  TaxonomyCategory,
  TaxonomyTag,
} from "@/lib/content/taxonomy";
import {
  isSupportedImageType,
  MAX_IMAGE_BYTES,
  MAX_PROMPT_IMAGES,
} from "@/lib/uploads/constraints";

interface PromptEditorProps {
  aiTools: AiTool[];
  categories: TaxonomyCategory[];
  defaultAuthorName: string;
  tags: TaxonomyTag[];
}

interface UploadedImage {
  objectKey: string;
}

interface EditorImage {
  file: File;
  height: number;
  id: string;
  previewUrl: string;
  uploaded?: UploadedImage;
  width: number;
}

interface PresignResponse {
  error?: string;
  objectKey?: string;
  requiredHeaders?: Record<string, string>;
  uploadUrl?: string;
}

function imageDimensions(file: File) {
  return new Promise<{ height: number; width: number }>((resolve, reject) => {
    const previewUrl = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      resolve({ height: image.naturalHeight, width: image.naturalWidth });
      URL.revokeObjectURL(previewUrl);
    };
    image.onerror = () => {
      reject(new Error("无法读取图片尺寸"));
      URL.revokeObjectURL(previewUrl);
    };
    image.src = previewUrl;
  });
}

function fieldClassName() {
  return "space-y-2";
}

function labelClassName() {
  return "block text-sm font-medium text-foreground";
}

export function PromptEditor({
  aiTools,
  categories,
  defaultAuthorName,
  tags,
}: PromptEditorProps) {
  const router = useRouter();
  const imagesRef = useRef<EditorImage[]>([]);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [authorName, setAuthorName] = useState(defaultAuthorName);
  const [authorUrl, setAuthorUrl] = useState("");
  const [categoryKey, setCategoryKey] = useState("");
  const [contentRelation, setContentRelation] =
    useState<ContentRelation>("repost");
  const [tagKeys, setTagKeys] = useState<string[]>([]);
  const [verifiedTools, setVerifiedTools] = useState<AiToolKey[]>([]);
  const [sourceUrl, setSourceUrl] = useState("");
  const [images, setImages] = useState<EditorImage[]>([]);
  const [isNsfw, setIsNsfw] = useState(false);
  const [error, setError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  async function addFiles(fileList: FileList | File[]) {
    const available = MAX_PROMPT_IMAGES - images.length;
    const selected = Array.from(fileList).slice(0, available);

    if (selected.length === 0) {
      setError(`最多只能添加 ${MAX_PROMPT_IMAGES} 张图片。`);
      return;
    }

    const invalidType = selected.find((file) => !isSupportedImageType(file.type));
    if (invalidType) {
      setError("仅支持 JPG、PNG、WebP 或 AVIF 图片。");
      return;
    }

    const oversized = selected.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversized) {
      setError(`“${oversized.name}”超过 10 MB，请压缩后重试。`);
      return;
    }

    try {
      const nextImages = await Promise.all(
        selected.map(async (file) => {
          const dimensions = await imageDimensions(file);
          return {
            ...dimensions,
            file,
            id: crypto.randomUUID(),
            previewUrl: URL.createObjectURL(file),
          } satisfies EditorImage;
        }),
      );

      setImages((current) => [...current, ...nextImages].slice(0, MAX_PROMPT_IMAGES));
      setError("");
    } catch {
      setError("有图片无法读取，请更换文件后重试。");
    }
  }

  function removeImage(id: string) {
    setImages((current) => {
      const removed = current.find((image) => image.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return current.filter((image) => image.id !== id);
    });
  }

  function moveImage(index: number, offset: -1 | 1) {
    setImages((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function uploadImage(image: EditorImage) {
    if (image.uploaded) {
      return image.uploaded;
    }

    const presignResponse = await fetch("/api/uploads/presign", {
      body: JSON.stringify({
        contentType: image.file.type,
        size: image.file.size,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const presign = (await presignResponse.json()) as PresignResponse;

    if (
      !presignResponse.ok ||
      !presign.uploadUrl ||
      !presign.objectKey ||
      !presign.requiredHeaders
    ) {
      throw new Error(presign.error || "无法准备图片上传。");
    }

    const uploadResponse = await fetch(presign.uploadUrl, {
      body: image.file,
      headers: presign.requiredHeaders,
      method: "PUT",
    });

    if (!uploadResponse.ok) {
      throw new Error("图片上传失败，请检查 R2 CORS 配置后重试。");
    }

    const uploaded = { objectKey: presign.objectKey };
    setImages((current) =>
      current.map((item) => (item.id === image.id ? { ...item, uploaded } : item)),
    );
    setUploadedCount((count) => count + 1);
    return uploaded;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (images.length === 0) {
      setError("请至少添加一张图片。");
      return;
    }

    if (!categoryKey) {
      setError("请选择作品的主分类。");
      return;
    }

    if (tagKeys.length === 0) {
      setError("请至少选择一个标签。");
      return;
    }

    setIsPublishing(true);
    setUploadedCount(images.filter((image) => image.uploaded).length);

    try {
      const uploadedImages = await Promise.all(images.map(uploadImage));
      const imageInputs: PublishPromptImageInput[] = uploadedImages.map(
        (uploaded, index) => ({
          alt: `${title.trim()}${images.length > 1 ? ` ${index + 1}` : ""}`,
          height: images[index].height,
          objectKey: uploaded.objectKey,
          position: index + 1,
          width: images[index].width,
        }),
      );
      const result = await publishPrompt({
        authorName,
        authorUrl,
        categoryKey,
        contentRelation,
        images: imageInputs,
        isNsfw,
        prompt,
        sourceUrl,
        tagKeys,
        title,
        verifiedTools,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      const params = new URLSearchParams({
        success: "作品已提交，审核通过后会公开展示。",
      });
      router.push(`/account?${params.toString()}`);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "提交没有完成，请稍后重试。",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-10">
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,0.78fr)_minmax(22rem,0.52fr)] lg:gap-16">
        <div className="space-y-10">
          <section aria-labelledby="content-section">
            <div className="mb-5 flex items-baseline gap-3 border-b border-border/80 pb-3">
              <span className="font-serif text-sm text-primary" aria-hidden="true">
                壹
              </span>
              <h2 id="content-section" className="font-serif text-xl">
                作品内容
              </h2>
            </div>

            <div className="space-y-5">
              <div className={fieldClassName()}>
                <label className={labelClassName()} htmlFor="title">
                  标题
                </label>
                <Input
                  id="title"
                  maxLength={120}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="给这组作品一个清楚的名字"
                  required
                  value={title}
                />
              </div>

              <TaxonomySelector
                categories={categories}
                categoryKey={categoryKey}
                disabled={isPublishing}
                onCategoryChange={setCategoryKey}
                onTagKeysChange={setTagKeys}
                tagKeys={tagKeys}
                tags={tags}
              />

              <div className={fieldClassName()}>
                <label className={labelClassName()} htmlFor="prompt">
                  完整提示词
                </label>
                <Textarea
                  id="prompt"
                  maxLength={20000}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="粘贴可以直接用于生成的完整提示词"
                  required
                  rows={12}
                  value={prompt}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {prompt.length} / 20000
                </p>
              </div>
            </div>
          </section>

          <section aria-labelledby="source-section">
            <div className="mb-5 flex items-baseline gap-3 border-b border-border/80 pb-3">
              <span className="font-serif text-sm text-primary" aria-hidden="true">
                贰
              </span>
              <h2 id="source-section" className="font-serif text-xl">
                作者与来源
              </h2>
            </div>

            <div className="space-y-5">
              <div className={fieldClassName()}>
                <label className={labelClassName()} htmlFor="author-name">
                  作者名称
                </label>
                <Input
                  id="author-name"
                  maxLength={80}
                  onChange={(event) => setAuthorName(event.target.value)}
                  placeholder="例如 @作者名"
                  required
                  value={authorName}
                />
              </div>

              <div className={fieldClassName()}>
                <label className={labelClassName()} htmlFor="author-url">
                  作者链接
                </label>
                <Input
                  id="author-url"
                  onChange={(event) => setAuthorUrl(event.target.value)}
                  placeholder="https://"
                  required
                  type="url"
                  value={authorUrl}
                />
              </div>

              <div className={fieldClassName()}>
                <label className={labelClassName()} htmlFor="source-url">
                  来源链接
                </label>
                <Input
                  id="source-url"
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://"
                  required
                  type="url"
                  value={sourceUrl}
                />
              </div>

              <ContentRelationSelector
                disabled={isPublishing}
                onChange={setContentRelation}
                value={contentRelation}
              />

              <VerifiedToolsSelector
                disabled={isPublishing}
                onChange={setVerifiedTools}
                tools={aiTools}
                value={verifiedTools}
              />
            </div>
          </section>
        </div>

        <section aria-labelledby="images-section" className="lg:sticky lg:top-6">
          <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-border/80 pb-3">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-sm text-primary" aria-hidden="true">
                叁
              </span>
              <h2 id="images-section" className="font-serif text-xl">
                图片
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">
              {images.length} / {MAX_PROMPT_IMAGES}
            </span>
          </div>

          <input
            accept="image/avif,image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={isPublishing || images.length >= MAX_PROMPT_IMAGES}
            id="prompt-images"
            multiple
            onChange={(event) => {
              if (event.target.files) {
                void addFiles(event.target.files);
              }
              event.target.value = "";
            }}
            type="file"
          />

          {images.length === 0 ? (
            <label
              className="group grid min-h-56 cursor-pointer place-items-center border border-dashed border-border bg-muted/25 px-6 text-center transition-colors hover:border-primary/60 hover:bg-muted/50 focus-within:border-primary"
              htmlFor="prompt-images"
            >
              <span>
                <ImagePlus
                  aria-hidden="true"
                  className="mx-auto mb-4 size-6 text-primary"
                />
                <span className="block text-sm font-medium">选择图片</span>
                <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                  JPG、PNG、WebP 或 AVIF，单张不超过 10 MB
                </span>
              </span>
            </label>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {images.map((image, index) => (
                <figure key={image.id} className="group relative bg-muted">
                  <div
                    className="relative overflow-hidden border border-border/70"
                    style={{ aspectRatio: `${image.width} / ${image.height}` }}
                  >
                    <Image
                      alt={`待提交图片 ${index + 1}`}
                      className="object-cover"
                      fill
                      sizes="(max-width: 1023px) 50vw, 220px"
                      src={image.previewUrl}
                      unoptimized
                    />
                  </div>
                  <figcaption className="flex h-11 items-center justify-between border-x border-b border-border/70 bg-background px-1">
                    <span className="pl-1 text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="flex items-center">
                      <Button
                        aria-label="向前移动"
                        className="size-11"
                        disabled={isPublishing || index === 0}
                        onClick={() => moveImage(index, -1)}
                        size="icon-sm"
                        title="向前移动"
                        type="button"
                        variant="ghost"
                      >
                        <ArrowLeft aria-hidden="true" />
                      </Button>
                      <Button
                        aria-label="向后移动"
                        className="size-11"
                        disabled={isPublishing || index === images.length - 1}
                        onClick={() => moveImage(index, 1)}
                        size="icon-sm"
                        title="向后移动"
                        type="button"
                        variant="ghost"
                      >
                        <ArrowRight aria-hidden="true" />
                      </Button>
                      <Button
                        aria-label="删除图片"
                        className="size-11"
                        disabled={isPublishing}
                        onClick={() => removeImage(image.id)}
                        size="icon-sm"
                        title="删除图片"
                        type="button"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </span>
                  </figcaption>
                </figure>
              ))}

              {images.length < MAX_PROMPT_IMAGES ? (
                <label
                  className="grid min-h-32 cursor-pointer place-items-center border border-dashed border-border text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary"
                  htmlFor="prompt-images"
                >
                  <span className="flex flex-col items-center gap-2 text-xs">
                    <ImagePlus aria-hidden="true" className="size-5" />
                    继续添加
                  </span>
                </label>
              ) : null}
            </div>
          )}

          <div className="mt-5 flex items-start justify-between gap-5 border-y border-border/80 py-4">
            <div className="min-w-0">
              <label
                className="block cursor-pointer text-sm font-medium text-foreground"
                htmlFor="is-nsfw"
              >
                敏感内容（NSFW）
              </label>
              <p
                className="mt-1 text-xs leading-5 text-muted-foreground"
                id="is-nsfw-description"
              >
                审核通过后，公开页面会默认模糊图片，访客点击后才会显示。
              </p>
            </div>
            <Switch
              aria-describedby="is-nsfw-description"
              checked={isNsfw}
              disabled={isPublishing}
              id="is-nsfw"
              onCheckedChange={setIsNsfw}
            />
          </div>

          <div aria-live="polite" className="mt-6 min-h-6">
            {error ? (
              <p className="text-sm leading-6 text-destructive">{error}</p>
            ) : isPublishing ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                正在上传 {uploadedCount} / {images.length}
              </p>
            ) : null}
          </div>

          <Button
            className="mt-3 min-h-11 w-full rounded-sm"
            disabled={isPublishing}
            size="lg"
            type="submit"
          >
            {isPublishing ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload aria-hidden="true" />
            )}
            {isPublishing ? "正在提交" : "提交审核"}
          </Button>
        </section>
      </div>
    </form>
  );
}
