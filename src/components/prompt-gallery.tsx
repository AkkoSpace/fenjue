import Image from "next/image";

import { PromptCarousel } from "@/components/prompt-carousel";
import { cn } from "@/lib/utils";
import type { PromptImage } from "@/lib/content/types";

interface PromptGalleryProps {
  coverOnly?: boolean;
  eager?: boolean;
  images: PromptImage[];
  sizes?: string;
  title: string;
}

const CARD_IMAGE_SIZES =
  "(max-width: 767px) calc(100vw - 40px), (max-width: 1535px) calc((min(100vw - 64px, 1440px) - 24px) / 2), (max-width: 2047px) calc((min(100vw - 64px, 1440px) - 48px) / 3), 464px";

export function PromptGallery({
  coverOnly = false,
  eager = false,
  images,
  sizes = CARD_IMAGE_SIZES,
  title,
}: PromptGalleryProps) {
  const coverImage = images[0];
  const displayedImages = coverOnly ? images.slice(0, 1) : images;

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
        {stackedImages.map((_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={cn(
              "absolute inset-0 rounded-sm border border-border/80 bg-card shadow-sm",
              index === 0
                ? "z-10 translate-x-2 translate-y-2 rotate-[0.8deg]"
                : "z-0 translate-x-3 translate-y-3 rotate-[1.6deg]",
            )}
          />
        ))}

        <figure className="relative z-20 size-full overflow-hidden rounded-sm border border-border/60 bg-muted">
          <Image
            src={coverImage.src}
            alt={coverImage.alt}
            fill
            fetchPriority={eager ? "high" : "auto"}
            loading={eager ? "eager" : "lazy"}
            sizes={sizes}
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.01] motion-reduce:transition-none"
          />
        </figure>
      </div>
    );
  }

  const detailImages = displayedImages.filter(
    (image): image is PromptImage & { src: string } => Boolean(image.src),
  );

  if (detailImages.length > 1) {
    return <PromptCarousel images={detailImages} title={title} />;
  }

  return (
    <div className="grid grid-cols-1" aria-label={`${title}图片`}>
      {detailImages.map((image, index) => {
        if (!image.src) {
          return null;
        }

        return (
          <figure
            key={`${image.src}-${index}`}
            className="relative overflow-hidden bg-muted"
            style={{ aspectRatio: `${image.width} / ${image.height}` }}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              preload={index === 0}
              sizes="(max-width: 1439px) calc(100vw - 40px), 1376px"
              className="object-cover transition-transform duration-500 ease-out hover:scale-[1.01] motion-reduce:transition-none"
            />
          </figure>
        );
      })}
    </div>
  );
}
