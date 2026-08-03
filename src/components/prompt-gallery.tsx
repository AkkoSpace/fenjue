import Image from "next/image";

import { cn } from "@/lib/utils";
import type { PromptImage } from "@/lib/content/types";

interface PromptGalleryProps {
  coverOnly?: boolean;
  images: PromptImage[];
  title: string;
}

export function PromptGallery({
  coverOnly = false,
  images,
  title,
}: PromptGalleryProps) {
  const coverImage = images[0];
  const displayedImages = coverOnly ? images.slice(0, 1) : images;
  const hasMultipleImages = displayedImages.length > 1;

  if (coverOnly && coverImage?.src) {
    const stackedImages = images.slice(1, 3);

    return (
      <div
        className={cn(
          "relative",
          stackedImages.length > 0 && "mr-3 mb-3",
        )}
        style={{ aspectRatio: `${coverImage.width} / ${coverImage.height}` }}
        aria-label={`${title}封面${images.length > 1 ? `，共 ${images.length} 张图片` : ""}`}
      >
        {stackedImages.map((image, index) =>
          image.src ? (
            <figure
              key={image.src}
              aria-hidden="true"
              className={cn(
                "absolute inset-0 overflow-hidden rounded-sm border border-border/80 bg-muted shadow-sm",
                index === 0
                  ? "z-10 translate-x-2 translate-y-2 rotate-[0.8deg]"
                  : "z-0 translate-x-3 translate-y-3 rotate-[1.6deg]",
              )}
            >
              <Image
                src={image.src}
                alt=""
                fill
                sizes="(max-width: 767px) calc(100vw - 52px), (max-width: 1535px) 50vw, 33vw"
                className="object-cover"
              />
            </figure>
          ) : null,
        )}

        <figure className="relative z-20 size-full overflow-hidden rounded-sm border border-border/60 bg-muted">
          <Image
            src={coverImage.src}
            alt={coverImage.alt}
            fill
            priority
            sizes="(max-width: 767px) calc(100vw - 52px), (max-width: 1535px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.01] motion-reduce:transition-none"
          />
        </figure>
      </div>
    );
  }

  return (
    <div
      className={cn(
        hasMultipleImages
          ? "-mx-5 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:grid sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
          : "grid grid-cols-1",
        images.length === 2 && "sm:grid-cols-2",
        images.length >= 3 && "sm:grid-cols-3",
      )}
      aria-label={`${title}图片`}
    >
      {displayedImages.map((image, index) => {
        if (!image.src) {
          return null;
        }

        return (
          <figure
            key={`${image.src}-${index}`}
            className={cn(
              "relative overflow-hidden bg-muted",
              hasMultipleImages &&
                "w-[82vw] max-w-[22rem] shrink-0 snap-start sm:w-auto sm:max-w-none",
            )}
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={index === 0}
              sizes={
                images.length > 1
                  ? "(max-width: 639px) 82vw, (max-width: 1439px) 33vw, 460px"
                  : "(max-width: 1439px) calc(100vw - 40px), 1376px"
              }
              className="object-cover transition-transform duration-500 ease-out hover:scale-[1.01] motion-reduce:transition-none"
            />
          </figure>
        );
      })}
    </div>
  );
}
