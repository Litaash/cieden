import { BadgeCheck, Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type FeatureCard = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const FEATURES: FeatureCard[] = [
  {
    icon: BadgeCheck,
    title: "Evidence, not vibes",
    body: "Every insight quotes specific copy or references a named screenshot element. No generic ‘improve your CTA’ advice.",
  },
  {
    icon: Search,
    title: "Real competitors",
    body: "Competitors are picked via live Google Search grounding with cited sources — not pulled from a stale database.",
  },
  {
    icon: Sparkles,
    title: "Designer-grade output",
    body: "Hierarchy, contrast, whitespace, cognitive load — the tool thinks in design terms, not SEO checkboxes.",
  },
];

export function FeatureCards({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-3 sm:gap-6",
        className,
      )}
    >
      {FEATURES.map((feature) => (
        <FeatureCardItem key={feature.title} {...feature} />
      ))}
    </div>
  );
}

function FeatureCardItem({ icon: Icon, title, body }: FeatureCard) {
  return (
    <div
      className={cn(
        "group rounded-xl border bg-card/60 p-5 backdrop-blur",
        "transition-all duration-200 ease-out",
        "hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm",
      )}
    >
      <div
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-lg",
          "bg-primary/10 text-primary",
          "transition-colors group-hover:bg-primary/15",
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="mt-4 text-sm font-medium">{title}</div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {body}
      </p>
    </div>
  );
}
