"use client";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

const STEP_LABELS: Record<(typeof STEP_ORDER)[number], string> = {
  starting: "Starting",
  competitors: "Finding competitors",
  capture: "Capturing screenshots",
  analyze: "Analyzing design & copy",
  synthesize: "Synthesizing insights",
  persist: "Saving report",
};

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
    STEP_ORDER.indexOf(step as (typeof STEP_ORDER)[number]),
  );
  const progressPct = Math.min(
    100,
    Math.round(((currentStepIndex + 1) / STEP_ORDER.length) * 100),
  );

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            {statusMessage || "Working…"}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {STEP_ORDER.map((s, i) => (
              <Badge
                key={s}
                variant={i === currentStepIndex ? "default" : "secondary"}
                className={cn(
                  "text-[10px] font-normal uppercase tracking-wider px-2 py-0.5",
                  i < currentStepIndex && "opacity-50",
                  i > currentStepIndex && "opacity-30",
                )}
              >
                {STEP_LABELS[s]}
              </Badge>
            ))}
          </div>
        </div>
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground whitespace-nowrap"
        >
          Cancel
        </button>
      </div>

      <Progress value={progressPct} className="mt-4 h-1.5" />

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
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
              <div className="h-6 w-6 rounded-full border-2 border-current border-t-transparent animate-spin opacity-40" />
              <span className="opacity-60">capturing…</span>
            </div>
          </div>
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
