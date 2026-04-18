import { Cloud, Image as ImageIcon, Sparkles, Triangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type TechPill = {
  icon: LucideIcon;
  label: string;
};

const PILLS: TechPill[] = [
  { icon: Triangle, label: "Next.js 16" },
  { icon: Sparkles, label: "Gemini 2.5" },
  { icon: Cloud, label: "Firecrawl" },
  { icon: ImageIcon, label: "Vercel Blob" },
];

export function BuiltWith({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-2 sm:gap-3",
        className,
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Built with
      </span>
      {PILLS.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border bg-background/60 backdrop-blur",
            "px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground",
          )}
        >
          <Icon className="h-3 w-3" aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}
