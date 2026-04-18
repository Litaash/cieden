import { Camera, FileCheck, Link as LinkIcon, Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Step = {
  icon: LucideIcon;
  title: string;
  body: string;
};

const STEPS: Step[] = [
  {
    icon: LinkIcon,
    title: "Paste your URL",
    body: "Drop in your landing page — no signup, no setup.",
  },
  {
    icon: Search,
    title: "Find 3 competitors",
    body: "Live Google Search grounding picks direct rivals with sources.",
  },
  {
    icon: Camera,
    title: "Capture & analyze",
    body: "Full-page screenshots are taken and read by a design-literate model.",
  },
  {
    icon: FileCheck,
    title: "Get a prioritized crit",
    body: "Evidence-backed insights, ranked by impact — in under 90 seconds.",
  },
];

export function HowItWorks({ className }: { className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="mx-auto max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          How it works
        </div>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
          From URL to crit in four steps.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          The same pipeline you&rsquo;ll see streaming live on submit.
        </p>
      </div>

      <ol className="mt-10 grid gap-6 md:grid-cols-4 md:gap-4">
        {STEPS.map((step, index) => (
          <StepItem
            key={step.title}
            step={step}
            index={index}
            isLast={index === STEPS.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}

function StepItem({
  step,
  index,
  isLast,
}: {
  step: Step;
  index: number;
  isLast: boolean;
}) {
  const { icon: Icon, title, body } = step;
  return (
    <li
      className={cn(
        "relative flex flex-col items-start gap-3",
        // Dashed connector line between steps on md+ screens
        !isLast &&
          "md:after:pointer-events-none md:after:absolute md:after:top-5 md:after:left-13 md:after:-right-2 md:after:h-px md:after:border-t md:after:border-dashed md:after:border-border",
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            "border bg-background text-primary shadow-sm",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
          <span
            className={cn(
              "absolute -right-1.5 -top-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full",
              "bg-primary text-[9px] font-semibold tabular-nums text-primary-foreground",
              "ring-2 ring-background",
            )}
            aria-hidden
          >
            {index + 1}
          </span>
        </div>
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </li>
  );
}
