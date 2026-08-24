"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ContentRelationSelector } from "@/components/submission/content-relation-selector";
import { EditorialSelector } from "@/components/admin/editorial-selector";
import { TaxonomySelector } from "@/components/submission/taxonomy-selector";
import { VerifiedToolsSelector } from "@/components/submission/verified-tools-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  updateAdminPrompt,
  type AdminCollectionMembershipInput,
  type UpdateAdminPromptImageInput,
} from "@/lib/admin/actions";
import type { AdminCollection } from "@/lib/admin/editorial-queries";
import type { AdminPromptDetail } from "@/lib/admin/queries";
import type { AiTool, AiToolKey } from "@/lib/content/ai-tools";
import {
  getContentRelationOption,
  type ContentRelation,
} from "@/lib/content/relation";
import type { TaxonomyCategory, TaxonomyTag } from "@/lib/content/taxonomy";
import {
  isSupportedImageType,
  MAX_IMAGE_BYTES,
  MAX_PROMPT_IMAGES,
} from "@/lib/uploads/constraints";

interface AdminPromptEditorProps {
  aiTools: AiTool[];
  categories: TaxonomyCategory[];
  collections: AdminCollection[];
  initial: AdminPromptDetail;
  tags: TaxonomyTag[];
}

interface PresignResponse {
  error?: string;
  objectKey?: string;
  requiredHeaders?: Record<string, string>;
  uploadUrl?: string;
}

interface EditorImage {
  alt: string;
  file?: File;
  height: number;
  id: string;
  objectKey?: string;
  previewUrl: string;
  uploadedObjectKey?: string;
  width: number;
}

interface RemovedImage {
  image: EditorImage;
  index: number;
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

function initialImages(prompt: AdminPromptDetail): EditorImage[] {
  return prompt.images.map((image) => ({
    alt: image.alt,
    height: image.height,
    id: image.id,
    objectKey: image.objectKey,
    previewUrl: image.src,
    width: image.width,
  }));
}

export function AdminPromptEditor({
  aiTools,
  categories,
  collections,
  initial,
  tags,
}: AdminPromptEditorProps) {
  const router = useRouter();
  const imagesRef = useRef<EditorImage[]>([]);
  const [title, setTitle] = useState(initial.title);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [authorName, setAuthorName] = useState(initial.authorName);
  const [authorUrl, setAuthorUrl] = useState(initial.authorUrl);
  const [sourceUrl, setSourceUrl] = useState(initial.sourceUrl);
  const [categoryKey, setCategoryKey] = useState(initial.category.key);
  const [contentRelation, setContentRelation] =
    useState<ContentRelation>(initial.contentRelation);
  const [tagKeys, setTagKeys] = useState(initial.tags.map((tag) => tag.key));
  const [verifiedTools, setVerifiedTools] =
    useState<AiToolKey[]>(initial.verifiedTools.map((tool) => tool.key));
  const [featured, setFeatured] = useState(initial.featured);
  const [featureRecommendation, setFeatureRecommendation] = useState(
    initial.featureRecommendation,
  );
  const [featurePosition, setFeaturePosition] = useState(initial.featurePosition);
  const [collectionMemberships, setCollectionMemberships] = useState<
    AdminCollectionMembershipInput[]
  >(initial.collectionMemberships);
  const [images, setImages] = useState(() => initialImages(initial));
  const [selectedImageId, setSelectedImageId] = useState(
    () => initial.images[0]?.id ?? "",
  );
  const [removed, setRemoved] = useState<RemovedImage[]>([]);
  const [isNsfw, setIsNsfw] = useState(initial.isNsfw);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => {
        if (image.file) URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, []);

  async function addFiles(fileList: FileList | File[]) {
    const available = MAX_PROMPT_IMAGES - images.length;
    const selected = Array.from(fileList).slice(0, available);
    if (!selected.length) {
      setError(`最多只能保留 ${MAX_PROMPT_IMAGES} 张图片。`);
      return;
    }

    const invalid = selected.find((file) => !isSupportedImageType(file.type));
    if (invalid) {
      setError("仅支持 JPG、PNG、WebP 或 AVIF 图片。");
      return;
    }
    const oversized = selected.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversized) {
      setError(`“${oversized.name}”超过 10 MB，请压缩后重试。`);
      return;
    }

    try {
      const additions = await Promise.all(
        selected.map(async (file, offset) => {
          const dimensions = await imageDimensions(file);
          return {
            ...dimensions,
            alt: `${title.trim() || "作品图片"} ${images.length + offset + 1}`,
            file,
            id: crypto.randomUUID(),
            previewUrl: URL.createObjectURL(file),
          } satisfies EditorImage;
        }),
      );
      setImages((current) => [...current, ...additions]);
      setSelectedImageId(additions[0].id);
      setError("");
    } catch {
      setError("有图片无法读取，请更换文件后重试。 ");
    }
  }

  function removeImage(index: number) {
    const image = images[index];
    if (!image) return;
    if (images.length === 1) {
      setError("作品至少需要保留一张图片。 ");
      return;
    }

    const nextSelectedImage = images[index + 1] ?? images[index - 1];
    setRemoved((items) => [...items, { image, index }]);
    setImages((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
    if (image.id === selectedImageId && nextSelectedImage) {
      setSelectedImageId(nextSelectedImage.id);
    }
  }

  function undoLastRemoval() {
    const last = removed.at(-1);
    if (!last) return;
    setImages((items) => {
      const next = [...items];
      next.splice(Math.min(last.index, next.length), 0, last.image);
      return next;
    });
    setSelectedImageId(last.image.id);
    setRemoved((current) => current.slice(0, -1));
    setError("");
  }

  function moveImage(index: number, offset: -1 | 1) {
    setImages((current) => {
      const target = index + offset;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function updateAlt(id: string, alt: string) {
    setImages((current) =>
      current.map((image) => (image.id === id ? { ...image, alt } : image)),
    );
  }

  async function uploadImage(image: EditorImage) {
    if (image.objectKey) return image.objectKey;
    if (image.uploadedObjectKey) return image.uploadedObjectKey;
    if (!image.file) throw new Error("新增图片文件已经失效，请重新选择。 ");

    const presignResponse = await fetch("/api/uploads/presign", {
      body: JSON.stringify({ contentType: image.file.type, size: image.file.size }),
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const presign = (await presignResponse.json()) as PresignResponse;
    if (!presignResponse.ok || !presign.uploadUrl || !presign.objectKey || !presign.requiredHeaders) {
      throw new Error(presign.error || "无法准备图片上传。 ");
    }

    const uploadResponse = await fetch(presign.uploadUrl, {
      body: image.file,
      headers: presign.requiredHeaders,
      method: "PUT",
    });
    if (!uploadResponse.ok) throw new Error("图片上传失败，请检查 R2 CORS 配置。 ");

    setImages((current) =>
      current.map((item) =>
        item.id === image.id
          ? { ...item, uploadedObjectKey: presign.objectKey }
          : item,
      ),
    );
    setUploadProgress((progress) => ({ ...progress, done: progress.done + 1 }));
    return presign.objectKey;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!categoryKey) return setError("请选择主分类。 ");
    if (!tagKeys.length) return setError("请至少选择一个标签。");
    if (!images.length) return setError("请至少保留一张图片。");

    setIsSaving(true);
    const pendingUploads = images.filter((image) => !image.objectKey);
    setUploadProgress({ done: 0, total: pendingUploads.length });

    try {
      const objectKeys = await Promise.all(images.map(uploadImage));
      const imageInputs: UpdateAdminPromptImageInput[] = images.map(
        (image, index) => ({
          alt: image.alt.trim(),
          height: image.height,
          objectKey: objectKeys[index],
          position: index + 1,
          width: image.width,
        }),
      );
      const result = await updateAdminPrompt({
        authorName,
        authorUrl,
        categoryKey,
        collectionMemberships,
        contentRelation,
        featured,
        featurePosition,
        featureRecommendation,
        id: initial.id,
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

      const params = new URLSearchParams();
      params.set(
        result.warning ? "warning" : "success",
        result.warning || `《${title.trim()}》已保存。`,
      );
      router.push(`/admin/content?${params.toString()}`);
      router.refresh();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "保存失败，请稍后重试。",
      );
    } finally {
      setIsSaving(false);
    }
  }

  const selectedImageIndex = Math.max(
    0,
    images.findIndex((image) => image.id === selectedImageId),
  );
  const selectedImage = images[selectedImageIndex];
  const categoryName =
    categories.find((category) => category.key === categoryKey)?.name ?? "未分类";
  const selectedTagNames = tags
    .filter((tag) => tagKeys.includes(tag.key))
    .map((tag) => tag.name);
  const selectedToolNames = aiTools
    .filter((tool) => verifiedTools.includes(tool.key))
    .map((tool) => tool.name);
  const relationName = getContentRelationOption(contentRelation).label;

  return (
    <form className="mt-6" onSubmit={handleSubmit}>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.08fr)_minmax(26rem,0.82fr)] xl:gap-10">
        <div className="order-2 min-w-0 space-y-4">
          <section aria-labelledby="edit-content-heading">
            <div className="mb-5 flex items-baseline gap-3 border-b border-border pb-3">
              <span aria-hidden="true" className="font-serif text-sm text-primary">贰</span>
              <div>
                <h2 className="font-serif text-xl" id="edit-content-heading">标题与提示词</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  先核对用户最终会看到和复制的核心内容。
                </p>
              </div>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="admin-title">标题</label>
                <Input id="admin-title" maxLength={120} onChange={(event) => setTitle(event.target.value)} required value={title} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="admin-prompt">完整提示词</label>
                <Textarea className="min-h-72 resize-y leading-6" id="admin-prompt" maxLength={20000} onChange={(event) => setPrompt(event.target.value)} required rows={12} value={prompt} />
                <p className="text-right text-xs text-muted-foreground">{prompt.length} / 20000</p>
              </div>
            </div>
          </section>

          <details className="group border-y border-border">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-3 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">分类与标签</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {categoryName} · {selectedTagNames.length ? selectedTagNames.join(" / ") : "未选择标签"}
                </span>
              </span>
              <span className="text-xs text-muted-foreground group-open:hidden">编辑</span>
              <span className="hidden text-xs text-muted-foreground group-open:inline">收起</span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="pb-6 pt-2">
              <TaxonomySelector categories={categories} categoryKey={categoryKey} className="border-y-0 py-0" disabled={isSaving} onCategoryChange={setCategoryKey} onTagKeysChange={setTagKeys} tagKeys={tagKeys} tags={tags} />
            </div>
          </details>

          <details className="group border-b border-border">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-3 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">作者、来源与模型</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {authorName} · {relationName} · {selectedToolNames.length ? selectedToolNames.join(" / ") : "未标记模型"}
                </span>
              </span>
              <span className="text-xs text-muted-foreground group-open:hidden">核对</span>
              <span className="hidden text-xs text-muted-foreground group-open:inline">收起</span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="space-y-5 pb-6 pt-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="admin-author">作者名称</label>
                <Input id="admin-author" maxLength={80} onChange={(event) => setAuthorName(event.target.value)} required value={authorName} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="admin-author-url">作者链接</label>
                <Input id="admin-author-url" onChange={(event) => setAuthorUrl(event.target.value)} required type="url" value={authorUrl} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="admin-source-url">来源链接</label>
                <Input id="admin-source-url" onChange={(event) => setSourceUrl(event.target.value)} required type="url" value={sourceUrl} />
              </div>
              <ContentRelationSelector disabled={isSaving} onChange={setContentRelation} value={contentRelation} />
              <VerifiedToolsSelector disabled={isSaving} onChange={setVerifiedTools} tools={aiTools} value={verifiedTools} />
            </div>
          </details>

          <details className="group border-b border-border">
            <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-3 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">精选与专栏</span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {featured ? "司录精选" : "普通收录"} · {collectionMemberships.length ? `${collectionMemberships.length} 个专栏` : "未收录专栏"}
                </span>
              </span>
              <span className="text-xs text-muted-foreground group-open:hidden">设置</span>
              <span className="hidden text-xs text-muted-foreground group-open:inline">收起</span>
              <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="pb-6 pt-2">
              <EditorialSelector
                collections={collections}
                disabled={isSaving}
                featured={featured}
                featurePosition={featurePosition}
                featureRecommendation={featureRecommendation}
                memberships={collectionMemberships}
                onFeaturedChange={setFeatured}
                onFeaturePositionChange={setFeaturePosition}
                onFeatureRecommendationChange={setFeatureRecommendation}
                onMembershipsChange={setCollectionMemberships}
              />
            </div>
          </details>

          <div aria-live="polite" className="min-h-6 pt-2">
            {error ? <p className="text-sm leading-6 text-destructive">{error}</p> : isSaving ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />{uploadProgress.total ? `正在上传 ${uploadProgress.done} / ${uploadProgress.total}` : "正在保存修改"}</p>
            ) : null}
          </div>

          <Button className="min-h-11 w-full rounded-sm" disabled={isSaving} size="lg" type="submit" variant="outline">
            {isSaving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            {isSaving ? "正在保存" : "保存内容修改"}
          </Button>
        </div>

        <section aria-labelledby="edit-images-heading" className="order-1 min-w-0 xl:sticky xl:top-28">
          <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-baseline gap-3">
              <span aria-hidden="true" className="font-serif text-sm text-primary">壹</span>
              <div>
                <h2 className="font-serif text-xl" id="edit-images-heading">作品画面</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">封面、顺序与敏感内容标记</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{images.length} / {MAX_PROMPT_IMAGES}</span>
          </div>

          <input
            accept="image/avif,image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={isSaving || images.length >= MAX_PROMPT_IMAGES}
            id="admin-prompt-images"
            multiple
            onChange={(event) => {
              if (event.target.files) void addFiles(event.target.files);
              event.target.value = "";
            }}
            type="file"
          />

          {selectedImage ? (
            <figure>
              <div
                className="relative grid h-[clamp(28rem,66vh,44rem)] place-items-center overflow-hidden border border-border/80 bg-muted/30"
              >
                <Image
                  alt={selectedImage.alt || `作品图片 ${selectedImageIndex + 1}`}
                  className="object-contain"
                  fill
                  priority
                  sizes="(max-width: 1279px) calc(100vw - 2.5rem), 54vw"
                  src={selectedImage.previewUrl}
                  unoptimized={Boolean(selectedImage.file)}
                />
                <span className="absolute left-3 top-3 bg-foreground px-2 py-1 text-xs text-background">
                  {selectedImageIndex === 0
                    ? "封面"
                    : `第 ${selectedImageIndex + 1} 张`}
                </span>
                <a
                  className="absolute right-3 top-3 inline-flex min-h-11 items-center gap-1.5 border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  href={selectedImage.previewUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <ExternalLink aria-hidden="true" className="size-3.5" />
                  查看原图
                </a>
              </div>
              <figcaption className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <div className="space-y-2">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor={`image-alt-${selectedImage.id}`}
                  >
                    图片 {selectedImageIndex + 1} 替代文本
                  </label>
                  <Input
                    id={`image-alt-${selectedImage.id}`}
                    maxLength={240}
                    onChange={(event) =>
                      updateAlt(selectedImage.id, event.target.value)
                    }
                    placeholder="图片替代文本"
                    value={selectedImage.alt}
                  />
                </div>
                <div className="flex justify-end border border-border bg-background">
                  <Button
                    aria-label="向前移动"
                    className="size-11 rounded-none"
                    disabled={isSaving || selectedImageIndex === 0}
                    onClick={() => moveImage(selectedImageIndex, -1)}
                    size="icon-sm"
                    title="向前移动"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowLeft aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label="向后移动"
                    className="size-11 rounded-none border-l border-border"
                    disabled={
                      isSaving || selectedImageIndex === images.length - 1
                    }
                    onClick={() => moveImage(selectedImageIndex, 1)}
                    size="icon-sm"
                    title="向后移动"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowRight aria-hidden="true" />
                  </Button>
                  <Button
                    aria-label={`移除图片 ${selectedImageIndex + 1}`}
                    className="size-11 rounded-none border-l border-border text-destructive"
                    disabled={isSaving || images.length === 1}
                    onClick={() => removeImage(selectedImageIndex)}
                    size="icon-sm"
                    title="移除图片"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
              </figcaption>
            </figure>
          ) : null}

          <div className="mt-5 grid grid-cols-4 gap-2 sm:grid-cols-6 xl:grid-cols-4 2xl:grid-cols-6">
            {images.map((image, index) => {
              const selected = image.id === selectedImage?.id;
              return (
                <button
                  aria-label={`查看图片 ${index + 1}`}
                  aria-pressed={selected}
                  className="group relative min-h-16 overflow-hidden border bg-muted outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:ring-1 aria-pressed:ring-primary"
                  key={image.id}
                  onClick={() => setSelectedImageId(image.id)}
                  style={{ aspectRatio: "1 / 1" }}
                  type="button"
                >
                  <Image
                    alt=""
                    className="object-cover opacity-70 transition-opacity group-hover:opacity-100 group-aria-pressed:opacity-100"
                    fill
                    sizes="120px"
                    src={image.previewUrl}
                    unoptimized={Boolean(image.file)}
                  />
                  <span className="absolute bottom-1.5 left-1.5 bg-foreground/90 px-1.5 py-0.5 text-[0.6875rem] text-background">
                    {index === 0 ? "封面" : index + 1}
                  </span>
                </button>
              );
            })}
            {images.length < MAX_PROMPT_IMAGES ? (
              <label
                aria-disabled={isSaving}
                className="grid min-h-16 cursor-pointer place-items-center border border-dashed border-border text-center text-muted-foreground outline-none transition-colors hover:border-primary/60 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 aria-disabled:pointer-events-none aria-disabled:opacity-50"
                htmlFor="admin-prompt-images"
                onKeyDown={(event) => {
                  if (isSaving || (event.key !== "Enter" && event.key !== " ")) {
                    return;
                  }
                  event.preventDefault();
                  event.currentTarget.click();
                }}
                role="button"
                style={{ aspectRatio: "1 / 1" }}
                tabIndex={isSaving ? -1 : 0}
              >
                <span className="flex flex-col items-center gap-1.5 text-xs">
                  <ImagePlus aria-hidden="true" className="size-5" />
                  添加图片
                </span>
              </label>
            ) : null}
          </div>

          {removed.length ? (
            <div className="mt-4 flex items-center justify-between gap-4 border border-amber-700/25 bg-amber-700/5 px-3 py-2 text-sm text-amber-900" role="status">
              <span>已标记移除 {removed.length} 张，保存后才会真正删除。</span>
              <Button className="min-h-11 shrink-0 rounded-sm sm:min-h-9" disabled={isSaving} onClick={undoLastRemoval} size="sm" type="button" variant="ghost"><RotateCcw aria-hidden="true" />撤销一步</Button>
            </div>
          ) : null}

          <div className="mt-5 divide-y divide-border border-y border-border">
            <div className="flex items-start justify-between gap-5 py-4">
              <div><label className="text-sm font-medium" htmlFor="admin-nsfw">敏感内容（NSFW）</label><p className="mt-1 text-xs leading-5 text-muted-foreground">开启后前台图片默认模糊，需要访客主动查看。</p></div>
              <Switch aria-label="敏感内容" checked={isNsfw} disabled={isSaving} id="admin-nsfw" onCheckedChange={setIsNsfw} />
            </div>
          </div>

        </section>
      </div>
    </form>
  );
}
