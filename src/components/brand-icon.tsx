import type { SVGProps } from "react";

interface BrandIconProps extends SVGProps<SVGSVGElement> {
  brandKey?: string | null;
  name: string;
}

function normalizedKey(brandKey: string | null | undefined, name: string) {
  const key = (brandKey ?? name).trim().toLowerCase();
  if (key.includes("nano") || key.includes("香蕉")) return "nano-banana";
  if (key.includes("doubao") || key.includes("豆包")) return "doubao";
  if (key.includes("grok")) return "grok";
  if (key.includes("chatgpt") || key.includes("openai")) return "chatgpt";
  if (key.includes("bilibili") || key.includes("哔哩")) return "bilibili";
  if (key.includes("xiaoheihe") || key.includes("小黑盒")) return "xiaoheihe";
  if (key.includes("xiaohongshu") || key.includes("小红书")) return "xiaohongshu";
  if (key.includes("github")) return "github";
  if (key.includes("youtube")) return "youtube";
  if (key.includes("douyin") || key.includes("抖音")) return "douyin";
  return null;
}

export function hasBrandIcon(brandKey: string | null | undefined, name: string) {
  return Boolean(normalizedKey(brandKey, name));
}

export function BrandIcon({ brandKey, name, ...props }: BrandIconProps) {
  const key = normalizedKey(brandKey, name);

  switch (key) {
    case "nano-banana":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path
            d="M5.2 15.9c3.8 2.8 8.6 2.2 11.2-1.6 1-1.5 1.3-3.1 1.2-4.8 1.2 2.8.7 6.1-1.2 8.7-2.9 4-8.5 4.9-12.4 2.1a4.6 4.6 0 0 1-1.2-1.1c.8-.8 1.6-2 2.4-3.3Z"
            fill="#fbbc04"
          />
          <path
            d="M5.1 15.8c2.5-3.6 5.1-6.1 8.4-7.2 1.8-.6 3.2-.5 4.2.2-1.6-.3-3.1.5-4.5 2.1-2.1 2.5-4 4.1-6 4.8-1 .4-1.7.4-2.1.1Z"
            fill="#f9ab00"
          />
          <path d="M16.8 6.9c.5-.9 1.2-1.4 2.1-1.5-.1 1.1-.7 1.9-1.8 2.4Z" fill="#34a853" />
        </svg>
      );
    case "doubao":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M5.1 4.5h8.1a5.8 5.8 0 0 1 5.8 5.8v2.5a5.8 5.8 0 0 1-5.8 5.8H9l-3.9 2.2v-2.9a5.8 5.8 0 0 1-2-4.5v-3.1a5.8 5.8 0 0 1 2-4.4Z" fill="#4d53e8" />
          <path d="M13.8 7.2h1.1a4.3 4.3 0 0 1 4.3 4.3v1.3a4.3 4.3 0 0 1-4.3 4.3h-2.1l-2.1 1.1v-2.2a4.3 4.3 0 0 1-1.3-3.2v-1.3a4.3 4.3 0 0 1 4.4-4.3Z" fill="#8b5cf6" opacity=".9" />
          <circle cx="8.1" cy="12" r="1" fill="white" />
          <circle cx="11.2" cy="12" r="1" fill="white" />
        </svg>
      );
    case "grok":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="m12 2.8 1.7 6.3 5.9-2.7-2.7 5.9 6.3 1.7-6.3 1.7 2.7 5.9-5.9-2.7-1.7 6.3-1.7-6.3-5.9 2.7 2.7-5.9-6.3-1.7 6.3-1.7-2.7-5.9 5.9 2.7L12 2.8Z" fill="#161616" />
          <circle cx="12" cy="14" r="2.1" fill="currentColor" />
        </svg>
      );
    case "chatgpt":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M12 3.4a4.4 4.4 0 0 1 4.2 3.1 4.4 4.4 0 0 1 3.7 5.6 4.4 4.4 0 0 1-2.3 7.1 4.4 4.4 0 0 1-7.2 1.9 4.4 4.4 0 0 1-5.8-4.9 4.4 4.4 0 0 1 2.1-7.2A4.4 4.4 0 0 1 12 3.4Z" fill="none" stroke="#10a37f" strokeWidth="1.65" />
          <path d="m8.1 8.4 7.7 4.4m-7.7 2.8 7.7-4.4m-4.2-7.3v8.8m4.2 3.2-7.7-4.4m.8-3.1 7.7 4.4" fill="none" stroke="#10a37f" strokeLinecap="round" strokeWidth="1.15" />
        </svg>
      );
    case "bilibili":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <rect x="2.5" y="5.7" width="19" height="13.4" rx="3.2" fill="#fb7299" />
          <path d="m8 5 1.7-2m6.3 2-1.7-2" stroke="#fb7299" strokeLinecap="round" strokeWidth="1.5" />
          <circle cx="9" cy="12.4" r="1.15" fill="white" />
          <circle cx="15" cy="12.4" r="1.15" fill="white" />
          <path d="M7.1 16.1h9.8" stroke="white" strokeLinecap="round" strokeWidth="1.2" />
        </svg>
      );
    case "xiaoheihe":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M5.5 8.4h13a3 3 0 0 1 2.8 4.2l-1.3 3.1a2.8 2.8 0 0 1-4.7.8L14 15h-4l-1.3 1.5a2.8 2.8 0 0 1-4.7-.8l-1.3-3.1a3 3 0 0 1 2.8-4.2Z" fill="#253047" />
          <path d="M7.2 11.8v3m-1.5-1.5h3m8.1-.1h.1m2.2-1.4h.1" stroke="#fff" strokeLinecap="round" strokeWidth="1.3" />
          <circle cx="17.1" cy="13.3" r=".8" fill="#ffb454" />
        </svg>
      );
    case "xiaohongshu":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="#ff2442" />
          <path d="M7 8.2h10M7 12h10M7 15.8h6" stroke="white" strokeLinecap="round" strokeWidth="1.5" />
          <path d="M8.1 6.1v11.8" stroke="white" strokeLinecap="round" strokeWidth="1.1" />
        </svg>
      );
    case "github":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <circle cx="12" cy="12" r="9.5" fill="#181717" />
          <path d="M8.3 16.7c.8.3 1.4.5 2.2.5 1.6 0 2.9-1 2.9-2.3v-1.2a3.5 3.5 0 0 0-1.5-6.6c-.4-.4-.5-.9-.5-1.4.9.1 1.5.4 2 .8.5-.1 1.1-.1 1.6 0 .5-.4 1.1-.7 2-.8 0 .5-.2 1-.5 1.4a3.5 3.5 0 0 0-1.5 6.6v1.2c0 1.3 1.3 2.3 2.9 2.3.8 0 1.5-.2 2.2-.5" fill="none" stroke="white" strokeLinecap="round" strokeWidth="1.15" />
        </svg>
      );
    case "youtube":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <rect x="2.2" y="6" width="19.6" height="12" rx="3.2" fill="#ff0000" />
          <path d="m10.2 9.2 5.2 2.8-5.2 2.8V9.2Z" fill="white" />
        </svg>
      );
    case "douyin":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M13.1 4.1v9.2a3.9 3.9 0 1 1-2.2-3.5V7.4c-1.5 1.4-2.7 2-4.1 2.1V6.8c2.7-.5 4.8-1.8 6.3-4.2Z" fill="#25f4ee" transform="translate(-.8 .7)" />
          <path d="M13.1 4.1v9.2a3.9 3.9 0 1 1-2.2-3.5V7.4c-1.5 1.4-2.7 2-4.1 2.1V6.8c2.7-.5 4.8-1.8 6.3-4.2Z" fill="#fe2c55" transform="translate(.8 -.7)" />
          <path d="M13.1 4.1v9.2a3.9 3.9 0 1 1-2.2-3.5V7.4c-1.5 1.4-2.7 2-4.1 2.1V6.8c2.7-.5 4.8-1.8 6.3-4.2Z" fill="#161616" />
        </svg>
      );
    default:
      return null;
  }
}
