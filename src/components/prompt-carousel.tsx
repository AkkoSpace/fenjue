"use client";

import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { PromptImage } from "@/lib/content/types";
import { cn } from "@/lib/utils";

type CarouselImage = PromptImage & { src: string };

interface PromptCarouselProps {
  images: CarouselImage[];
  title: string;
}

const AUTOPLAY_DELAY = 5000;
const SWIPE_THRESHOLD = 48;

export function PromptCarousel({ images, title }: PromptCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [focusedWithin, setFocusedWithin] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [touching, setTouching] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const carouselId = useId();
  const interactionPaused = focusedWithin || hovered || touching;
  const autoplayActive =
    !interactionPaused &&
    !userPaused &&
    pageVisible &&
    !prefersReducedMotion;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => setPrefersReducedMotion(media.matches);

    syncPreference();
    media.addEventListener("change", syncPreference);
    return () => media.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const syncVisibility = () => setPageVisible(!document.hidden);

    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, []);

  useEffect(() => {
    if (!autoplayActive) return;

    const timer = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % images.length);
    }, AUTOPLAY_DELAY);

    return () => window.clearTimeout(timer);
  }, [activeIndex, autoplayActive, images.length]);

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
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocusedWithin(false);
        }
      }}
      onFocusCapture={() => setFocusedWithin(true)}
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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      tabIndex={0}
    >
      <div
        className="relative aspect-[4/3] touch-pan-y overflow-hidden bg-muted sm:aspect-video"
        id={carouselId}
        onTouchCancel={() => {
          touchStartX.current = null;
          setTouching(false);
        }}
        onTouchEnd={(event) => {
          if (touchStartX.current !== null) {
            const distance =
              event.changedTouches[0].clientX - touchStartX.current;

            if (Math.abs(distance) >= SWIPE_THRESHOLD) {
              if (distance > 0) showPrevious();
              else showNext();
            }
          }

          touchStartX.current = null;
          setTouching(false);
        }}
        onTouchStart={(event) => {
          touchStartX.current = event.changedTouches[0].clientX;
          setTouching(true);
        }}
      >
        <div
          className="flex size-full transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
          style={{ transform: `translate3d(-${activeIndex * 100}%, 0, 0)` }}
        >
          {images.map((image, index) => (
            <figure
              aria-hidden={index !== activeIndex}
              aria-label={`第 ${index + 1} 张，共 ${images.length} 张：${image.alt}`}
              aria-roledescription="幻灯片"
              className="relative h-full w-full shrink-0"
              key={image.src}
            >
              <Image
                alt={image.alt}
                className="object-contain"
                fill
                priority={index === 0}
                sizes="(max-width: 1199px) calc(100vw - 40px), 1152px"
                src={image.src}
              />
            </figure>
          ))}
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-foreground/35 to-transparent"
        />

        {!prefersReducedMotion ? (
          <Button
            aria-label={userPaused ? "继续自动轮播" : "暂停自动轮播"}
            className="absolute right-3 top-3 z-20 size-11 rounded-sm border border-background/70 bg-background/90 text-foreground shadow-sm hover:bg-background"
            onClick={() => setUserPaused((paused) => !paused)}
            size="icon"
            type="button"
            variant="ghost"
          >
            {userPaused ? (
              <Play aria-hidden="true" className="size-4" />
            ) : (
              <Pause aria-hidden="true" className="size-4" />
            )}
          </Button>
        ) : null}

        <Button
          aria-controls={carouselId}
          aria-label="上一张图片"
          className="absolute left-3 top-1/2 z-20 size-11 -translate-y-1/2 rounded-sm border border-background/70 bg-background/90 text-foreground shadow-sm hover:bg-background"
          onClick={showPrevious}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Button>

        <Button
          aria-controls={carouselId}
          aria-label="下一张图片"
          className="absolute right-3 top-1/2 z-20 size-11 -translate-y-1/2 rounded-sm border border-background/70 bg-background/90 text-foreground shadow-sm hover:bg-background"
          onClick={showNext}
          size="icon"
          type="button"
          variant="ghost"
        >
          <ChevronRight aria-hidden="true" className="size-5" />
        </Button>

        <div
          aria-label="选择图片"
          className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center rounded-full bg-background/90 px-1.5 shadow-sm"
          role="group"
        >
          {images.map((image, index) => (
            <button
              aria-controls={carouselId}
              aria-label={`查看第 ${index + 1} 张图片`}
              aria-pressed={index === activeIndex}
              className="group grid size-8 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              key={`${image.src}-${index}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 rounded-full border border-foreground/65 transition-[transform,background-color,opacity] duration-200 ease-[cubic-bezier(0.25,1,0.5,1)] motion-reduce:transition-none",
                  index === activeIndex
                    ? "scale-125 bg-foreground opacity-100"
                    : "bg-transparent opacity-70 group-hover:opacity-100",
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <p
        aria-live={autoplayActive ? "off" : "polite"}
        className="sr-only"
      >
        第 {activeIndex + 1} 张，共 {images.length} 张
      </p>
    </section>
  );
}
