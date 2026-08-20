"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import { useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PromptImage } from "@/lib/content/types";
import { cn } from "@/lib/utils";

type CarouselImage = PromptImage & { src: string };

interface PromptCarouselProps {
  images: CarouselImage[];
  title: string;
}

const SWIPE_THRESHOLD = 48;

export function PromptCarousel({ images, title }: PromptCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const carouselId = useId();
  const activeImage = images[activeIndex];

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + images.length) % images.length);
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % images.length);
  }

  return (
    <section
      aria-label={`${title}图片轮播，共 ${images.length} 张`}
      aria-roledescription="轮播"
      className="w-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          showPrevious();
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          showNext();
        }
      }}
      tabIndex={0}
    >
      <figure
        aria-label={`第 ${activeIndex + 1} 张，共 ${images.length} 张：${activeImage.alt}`}
        aria-roledescription="幻灯片"
        className="relative h-[min(68svh,46rem)] min-h-80 touch-pan-y overflow-hidden bg-muted sm:min-h-[28rem]"
        id={carouselId}
        onTouchCancel={() => {
          touchStartX.current = null;
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) {
            return;
          }

          const distance = event.changedTouches[0].clientX - touchStartX.current;
          touchStartX.current = null;

          if (Math.abs(distance) < SWIPE_THRESHOLD) {
            return;
          }

          if (distance > 0) {
            showPrevious();
          } else {
            showNext();
          }
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.changedTouches[0].clientX;
        }}
      >
        <Image
          alt={activeImage.alt}
          className="object-contain motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
          fill
          key={activeImage.src}
          priority={activeIndex === 0}
          sizes="(max-width: 1199px) calc(100vw - 40px), 1152px"
          src={activeImage.src}
        />
      </figure>

      <div className="mt-3 grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-3 border-y border-border/80 py-2">
        <Button
          aria-controls={carouselId}
          aria-label="上一张图片"
          className="size-11 rounded-sm"
          onClick={showPrevious}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" />
        </Button>

        <p
          aria-live="polite"
          className="text-center text-xs tabular-nums text-muted-foreground"
        >
          <span aria-hidden="true">
            <span className="font-medium text-foreground">{activeIndex + 1}</span>
            {` / ${images.length}`}
          </span>
          <span className="sr-only">
            第 {activeIndex + 1} 张，共 {images.length} 张
          </span>
          <span aria-hidden="true" className="ml-2 hidden sm:inline">
            可使用方向键切换
          </span>
        </p>

        <Button
          aria-controls={carouselId}
          aria-label="下一张图片"
          className="size-11 rounded-sm"
          onClick={showNext}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <div
        aria-label="选择图片"
        className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
        role="group"
      >
        {images.map((image, index) => (
          <button
            aria-controls={carouselId}
            aria-label={`查看第 ${index + 1} 张图片`}
            aria-pressed={index === activeIndex}
            className={cn(
              "relative size-16 shrink-0 snap-start overflow-hidden border bg-muted outline-none transition-[border-color,opacity] sm:size-20",
              index === activeIndex
                ? "border-primary opacity-100 ring-1 ring-primary ring-offset-2 ring-offset-background"
                : "border-border opacity-55 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
            key={`${image.src}-${index}`}
            onClick={() => setActiveIndex(index)}
            type="button"
          >
            <Image
              alt=""
              className="object-cover"
              fill
              sizes="80px"
              src={image.src}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
