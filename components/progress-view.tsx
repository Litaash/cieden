"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  Competitor,
  FailureReasonCategory,
  SiteAnalysis,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";

export interface SiteState {
  url: string;
  name: string;
  role: "user" | "competitor";
  status: "pending" | "captured" | "analyzed" | "failed";
  screenshotUrl?: string;
  analysis?: SiteAnalysis;
  failureLabel?: string;
  failureReason?: string;
  failureCategory?: FailureReasonCategory;
}

const STEP_ORDER = [
  "starting",
  "competitors",
  "capture",
  "analyze",
  "synthesize",
  "persist",
] as const;

type Step = (typeof STEP_ORDER)[number];

const STEP_LABELS: Record<Step, string> = {
  starting: "Starting",
  competitors: "Finding competitors",
  capture: "Capturing screenshots",
  analyze: "Analyzing design & copy",
  synthesize: "Synthesizing insights",
  persist: "Saving report",
};

// Weighted slices of total progress per step. Tuned to how long each
// phase actually takes in practice: analysis dominates, capture is second,
// competitor research and synthesis are each ~10-15%. Each range is
// [lowBound, highBound] of the overall bar.
const STEP_RANGES: Record<Step, [number, number]> = {
  starting: [0, 4],
  competitors: [4, 20],
  capture: [20, 48],
  analyze: [48, 88],
  synthesize: [88, 96],
  persist: [96, 100],
};

function computeTarget(step: string, sites: SiteState[]): number {
  const range = STEP_RANGES[step as Step];
  if (!range) return 0;
  const [lo, hi] = range;
  const total = sites.length || 4;
  if (step === "capture") {
    const done = sites.filter((s) => s.status !== "pending").length;
    return lo + (hi - lo) * (total > 0 ? done / total : 0);
  }
  if (step === "analyze") {
    const done = sites.filter(
      (s) => s.status === "analyzed" || s.status === "failed",
    ).length;
    return lo + (hi - lo) * (total > 0 ? done / total : 0);
  }
  return lo;
}

interface Props {
  step: string;
  statusMessage: string;
  competitors: Competitor[];
  sites: SiteState[];
  onCancel: () => void;
}

export function ProgressView({
  step,
  statusMessage,
  competitors,
  sites,
  onCancel,
}: Props) {
  const currentStepIndex = Math.max(
    0,
    STEP_ORDER.indexOf(step as Step),
  );

  const target = computeTarget(step, sites);
  const stepRange = STEP_RANGES[step as Step] ?? [0, 100];
  const stepCeiling = stepRange[1];

  // `displayedPct` is what the UI actually paints. It reacts to events
  // (jumping up to `target`) and, when the target is static, gently creeps
  // toward the current step's upper bound so the bar never looks frozen.
  const [displayedPct, setDisplayedPct] = useState(0);
  const targetRef = useRef(target);
  const ceilingRef = useRef(stepCeiling);
  targetRef.current = target;
  ceilingRef.current = stepCeiling;

  useEffect(() => {
    const id = setInterval(() => {
      setDisplayedPct((prev) => {
        const t = targetRef.current;
        const creepCap = Math.max(t, ceilingRef.current - 2);
        if (prev < t) return Math.min(t, prev + 1.8);
        if (prev < creepCap) return Math.min(creepCap, prev + 0.35);
        return prev;
      });
    }, 280);
    return () => clearInterval(id);
  }, []);

  const progressPct = Math.min(100, Math.max(0, displayedPct));

  const currentLabel =
    STEP_LABELS[step as Step] ?? "Working…";

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex items-baseline justify-between gap-4">
        <div className="flex items-baseline gap-1.5 text-sm">
          <span className="tabular-nums text-muted-foreground/60 text-xs">
            {currentStepIndex + 1}&thinsp;/&thinsp;{STEP_ORDER.length}
          </span>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <span className="text-foreground/80">{currentLabel}</span>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground whitespace-nowrap"
        >
          Cancel
        </button>
      </div>

      <div className="mt-2.5 h-0.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-30" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
        </span>
        {statusMessage || "Working…"}
      </div>

      {competitors.length > 0 && (
        <div className="mt-10 rounded-lg border bg-muted/30 p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Direct competitors identified
          </div>
          <ul className="mt-3 space-y-2.5">
            {competitors.map((c) => (
              <li key={c.url} className="text-sm">
                <div className="flex items-baseline gap-2">
                  <span className="font-medium">{c.name}</span>
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {c.url.replace(/^https?:\/\//, "")}
                  </a>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.reasoning}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {sites.map((site) => (
          <SiteTile key={site.url} site={site} />
        ))}
      </div>
    </div>
  );
}

function SkeletonPage() {
  return (
    <div className="absolute inset-0 flex flex-col gap-2 p-3 animate-pulse">
      <div className="flex items-center gap-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-foreground/10" />
        <div className="h-1.5 w-12 rounded-full bg-foreground/10" />
        <div className="ml-auto h-1.5 w-8 rounded-full bg-foreground/10" />
      </div>
      <div className="h-px w-full bg-foreground/5" />
      <div className="mt-1 h-3 w-2/3 rounded bg-foreground/10" />
      <div className="h-2 w-full rounded bg-foreground/8" />
      <div className="h-2 w-5/6 rounded bg-foreground/8" />
      <div className="h-2 w-4/6 rounded bg-foreground/6" />
      <div className="mt-2 flex gap-1.5">
        <div className="h-4 w-14 rounded bg-foreground/12" />
        <div className="h-4 w-10 rounded bg-foreground/6" />
      </div>
      <div className="mt-3 h-16 w-full rounded bg-foreground/5" />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <div className="h-8 rounded bg-foreground/6" />
        <div className="h-8 rounded bg-foreground/5" />
        <div className="h-8 rounded bg-foreground/4" />
      </div>
    </div>
  );
}

function SiteTile({ site }: { site: SiteState }) {
  const isFailed = site.status === "failed";
  const borderClass = isFailed
    ? "border-destructive/30 bg-destructive/5"
    : site.role === "user"
      ? "border-primary/40 bg-primary/5"
      : "border-border bg-background";

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-lg border transition-colors",
        borderClass,
      )}
    >
      <div className="aspect-3/4 relative bg-muted overflow-hidden">
        {isFailed ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,0.03)_6px,rgba(0,0,0,0.03)_12px)]">
            <div className="flex flex-col items-center gap-1.5 text-center">
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-6 w-6 text-destructive/70"
              >
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              <span className="text-[11px] font-medium text-destructive/80">
                {site.failureLabel || "Capture failed"}
              </span>
            </div>
          </div>
        ) : site.screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={site.screenshotUrl}
            alt={`${site.name} landing page`}
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-top transition-all",
              site.status !== "analyzed" && "grayscale opacity-60",
            )}
          />
        ) : (
          <SkeletonPage />
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium truncate">{site.name}</div>
          {site.role === "user" && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0">
              You
            </Badge>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              site.status === "analyzed" && "bg-green-500",
              site.status === "captured" && "bg-amber-500",
              site.status === "pending" && "bg-muted-foreground/30",
              site.status === "failed" && "bg-destructive/60",
            )}
          />
          <span
            className={cn(
              "capitalize",
              site.status === "failed" && "text-destructive/80",
            )}
            title={site.status === "failed" ? site.failureReason : undefined}
          >
            {site.status === "failed"
              ? (site.failureLabel ?? "Failed")
              : site.status}
          </span>
        </div>
      </div>
    </div>
  );
}
