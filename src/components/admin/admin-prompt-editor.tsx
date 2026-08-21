"use client";

import {
  ArrowLeft,
  ArrowRight,
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
import { TaxonomySelector } from "@/components/submission/taxonomy-selector";
import { VerifiedToolsSelector } from "@/components/submission/verified-tools-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  updateAdminPrompt,
  type UpdateAdminPromptImageInput,
} from "@/lib/admin/actions";
import type { AdminPromptDetail } from "@/lib/admin/queries";
import type { AiToolKey } from "@/lib/content/ai-tools";
import type { ContentRelation } from "@/lib/content/relation";
import type { TaxonomyCategory, TaxonomyTag } from "@/lib/content/taxonomy";
import {
  isSupportedImageType,
  MAX_IMAGE_BYTES,
  MAX_PROMPT_IMAGES,
} from "@/lib/uploads/constraints";

interface AdminPromptEditorProps {
  categories: TaxonomyCategory[];
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
  categories,
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
    useState<AiToolKey[]>(initial.verifiedTools);
  const [images, setImages] = useState(() => initialImages(initial));
  const [removed, setRemoved] = useState<RemovedImage[]>([]);
  const [isNsfw, setIsNsfw] = useState(initial.isNsfw);
  const [published, setPublished] = useState(initial.published);
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
      setError("");
    } catch {
      setError("有图片无法读取，请更换文件后重试。 ");
    }
  }

  function removeImage(index: number) {
    setImages((current) => {
      const image = current[index];
      if (!image) return current;
      if (current.length === 1) {
        setError("作品至少需要保留一张图片。 ");
        return current;
      }
      setRemoved((items) => [...items, { image, index }]);
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function undoLastRemoval() {
    setRemoved((current) => {
      const last = current.at(-1);
      if (!last) return current;
      setImages((items) => {
        const next = [...items];
        next.splice(Math.min(last.index, next.length), 0, last.image);
        return next;
      });
      return current.slice(0, -1);
    });
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
        contentRelation,
        id: initial.id,
        images: imageInputs,
        isNsfw,
        prompt,
        published,
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

  return (
    <form className="mt-8" onSubmit={handleSubmit}>
      <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,0.9fr)_minmax(24rem,0.68fr)] xl:gap-14">
        <div className="space-y-10">
          <section aria-labelledby="edit-content-heading">
            <div className="mb-5 flex items-baseline gap-3 border-b border-border pb-3">
              <span aria-hidden="true" className="font-serif text-sm text-primary">壹</span>
              <h2 className="font-serif text-xl" id="edit-content-heading">作品内容</h2>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="admin-title">标题</label>
                <Input id="admin-title" maxLength={120} onChange={(event) => setTitle(event.target.value)} required value={title} />
              </div>
              <TaxonomySelector categories={categories} categoryKey={categoryKey} disabled={isSaving} onCategoryChange={setCategoryKey} onTagKeysChange={setTagKeys} tagKeys={tagKeys} tags={tags} />
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="admin-prompt">完整提示词</label>
                <Textarea id="admin-prompt" maxLength={20000} onChange={(event) => setPrompt(event.target.value)} required rows={14} value={prompt} />
                <p className="text-right text-xs text-muted-foreground">{prompt.length} / 20000</p>
              </div>
            </div>
          </section>

          <section aria-labelledby="edit-source-heading">
            <div className="mb-5 flex items-baseline gap-3 border-b border-border pb-3">
              <span aria-hidden="true" className="font-serif text-sm text-primary">贰</span>
              <h2 className="font-serif text-xl" id="edit-source-heading">作者与来源</h2>
            </div>
            <div className="space-y-5">
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
              <VerifiedToolsSelector disabled={isSaving} onChange={setVerifiedTools} value={verifiedTools} />
            </div>
          </section>
        </div>

        <section aria-labelledby="edit-images-heading" className="xl:sticky xl:top-6">
          <div className="mb-5 flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <div className="flex items-baseline gap-3">
              <span aria-hidden="true" className="font-serif text-sm text-primary">叁</span>
              <h2 className="font-serif text-xl" id="edit-images-heading">图片与状态</h2>
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

          <div className="grid grid-cols-2 gap-3">
            {images.map((image, index) => (
              <figure className="min-w-0 border border-border/80 bg-background" key={image.id}>
                <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
                  <Image alt={image.alt || `作品图片 ${index + 1}`} className="object-cover" fill sizes="(max-width: 1279px) 50vw, 240px" src={image.previewUrl} unoptimized={Boolean(image.file)} />
                  <span className="absolute left-2 top-2 bg-foreground/85 px-1.5 py-0.5 text-[0.6875rem] text-background">{index === 0 ? "封面" : index + 1}</span>
                </div>
                <figcaption className="p-2">
                  <label className="sr-only" htmlFor={`image-alt-${image.id}`}>图片 {index + 1} 替代文本</label>
                  <Input className="h-9 text-xs" id={`image-alt-${image.id}`} maxLength={240} onChange={(event) => updateAlt(image.id, event.target.value)} placeholder="图片替代文本" value={image.alt} />
                  <div className="mt-1 flex justify-end">
                    <Button aria-label="向前移动" className="size-11 sm:size-9" disabled={isSaving || index === 0} onClick={() => moveImage(index, -1)} size="icon-sm" title="向前移动" type="button" variant="ghost"><ArrowLeft aria-hidden="true" /></Button>
                    <Button aria-label="向后移动" className="size-11 sm:size-9" disabled={isSaving || index === images.length - 1} onClick={() => moveImage(index, 1)} size="icon-sm" title="向后移动" type="button" variant="ghost"><ArrowRight aria-hidden="true" /></Button>
                    <Button aria-label={`移除图片 ${index + 1}`} className="size-11 text-destructive sm:size-9" disabled={isSaving || images.length === 1} onClick={() => removeImage(index)} size="icon-sm" title="移除图片" type="button" variant="ghost"><Trash2 aria-hidden="true" /></Button>
                  </div>
                </figcaption>
              </figure>
            ))}
            {images.length < MAX_PROMPT_IMAGES ? (
              <label className="grid min-h-40 cursor-pointer place-items-center border border-dashed border-border text-center text-muted-foreground transition-colors hover:border-primary/60 hover:text-primary" htmlFor="admin-prompt-images">
                <span className="flex flex-col items-center gap-2 text-xs"><ImagePlus aria-hidden="true" className="size-5" />添加图片</span>
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
              <div><label className="text-sm font-medium" htmlFor="admin-published">公开展示</label><p className="mt-1 text-xs leading-5 text-muted-foreground">关闭后作品从前台和 Sitemap 中下架。</p></div>
              <Switch aria-label="公开展示" checked={published} disabled={isSaving} id="admin-published" onCheckedChange={setPublished} />
            </div>
            <div className="flex items-start justify-between gap-5 py-4">
              <div><label className="text-sm font-medium" htmlFor="admin-nsfw">敏感内容（NSFW）</label><p className="mt-1 text-xs leading-5 text-muted-foreground">开启后前台图片默认模糊，需要访客主动查看。</p></div>
              <Switch aria-label="敏感内容" checked={isNsfw} disabled={isSaving} id="admin-nsfw" onCheckedChange={setIsNsfw} />
            </div>
          </div>

          <div aria-live="polite" className="mt-5 min-h-6">
            {error ? <p className="text-sm leading-6 text-destructive">{error}</p> : isSaving ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle aria-hidden="true" className="size-4 animate-spin" />{uploadProgress.total ? `正在上传 ${uploadProgress.done} / ${uploadProgress.total}` : "正在保存修改"}</p>
            ) : null}
          </div>

          <Button className="mt-2 min-h-11 w-full rounded-sm" disabled={isSaving} size="lg" type="submit">
            {isSaving ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />}
            {isSaving ? "正在保存" : "保存修改"}
          </Button>
        </section>
      </div>
    </form>
  );
}
