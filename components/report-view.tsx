"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type {
  FailedCapture,
  Insight,
  InsightCategory,
  Report,
  SiteAnalysis,
} from "@/lib/schemas";
import { cn } from "@/lib/utils";

interface Props {
  report: Report;
  persistedReportId: string | null;
  onReset?: () => void;
}

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  hero: "Hero",
  cta: "CTA",
  social_proof: "Social proof",
  hierarchy: "Hierarchy",
  copy: "Copy",
};

const PRIORITY_STYLE: Record<Insight["priority"], string> = {
  high: "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400",
  med: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  low: "bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400",
};

export function ReportView({ report, persistedReportId, onReset }: Props) {
  const shareUrl = persistedReportId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/report/${persistedReportId}`
    : null;

  const userAnalysis = report.analyses.find((a) => a.url === report.userUrl);
  const competitorAnalyses = report.analyses.filter(
    (a) => a.url !== report.userUrl,
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-12">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Landing-page crit for
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {report.userName}
          </h1>
          <div className="text-sm text-muted-foreground">
            Benchmarked against{" "}
            {report.competitors.map((c, i) => (
              <span key={c.url}>
                {i > 0 && ", "}
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  {c.name}
                </a>
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {shareUrl && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                toast.success("Share link copied");
              }}
            >
              Copy share link
            </Button>
          )}
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              New analysis
            </Button>
          )}
        </div>
      </header>

      <TopRecommendations items={report.synthesis.topRecommendations} />

      <InsightList insights={report.synthesis.insights} />

      {report.synthesis.dontChange.length > 0 && (
        <DontChange items={report.synthesis.dontChange} />
      )}

      <Separator />

      <SitesGrid user={userAnalysis} competitors={competitorAnalyses} />

      {report.competitors.length > 0 && (
        <CompetitorSources
          competitors={report.competitors}
          failedCaptures={report.failedCaptures ?? []}
        />
      )}

      <footer className="pt-6 text-xs text-muted-foreground">
        Report id: <span className="font-mono">{report.id}</span> · Expires{" "}
        {new Date(report.expiresAt).toLocaleDateString()}
      </footer>
    </div>
  );
}

function TopRecommendations({ items }: { items: string[] }) {
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Top priorities
      </h2>
      <ol className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        {items.map((rec, i) => (
          <li
            key={i}
            className="relative rounded-xl border bg-card p-5 shadow-sm"
          >
            <div className="text-5xl font-semibold tabular-nums text-muted-foreground/20 absolute top-2 right-4 leading-none">
              {i + 1}
            </div>
            <p className="relative text-sm leading-relaxed">{rec}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

function InsightList({ insights }: { insights: Insight[] }) {
  const [filter, setFilter] = useState<InsightCategory | "all">("all");
  const [minConfidence, setMinConfidence] = useState(0);

  const filtered = insights.filter((i) => {
    if (filter !== "all" && i.category !== filter) return false;
    if (i.confidence < minConfidence) return false;
    return true;
  });

  const categories = Array.from(new Set(insights.map((i) => i.category)));

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          All insights ({insights.length})
        </h2>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "text-xs px-2.5 py-1 rounded-full border",
              filter === "all"
                ? "bg-foreground text-background border-foreground"
                : "bg-background hover:bg-muted",
            )}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border",
                filter === c
                  ? "bg-foreground text-background border-foreground"
                  : "bg-background hover:bg-muted",
              )}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
          <div className="hidden md:flex items-center gap-1.5 pl-2 ml-1 border-l">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
              min conf
            </label>
            <select
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="text-xs bg-background border rounded px-1.5 py-0.5"
            >
              <option value={0}>any</option>
              <option value={0.5}>0.5+</option>
              <option value={0.7}>0.7+</option>
              <option value={0.9}>0.9+</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {filtered.map((insight, i) => (
          <InsightCard key={i} insight={insight} />
        ))}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No insights match the current filters.
          </div>
        )}
      </div>
    </section>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <article className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-medium leading-snug">{insight.claim}</h3>
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 capitalize",
            PRIORITY_STYLE[insight.priority],
          )}
        >
          {insight.priority === "med" ? "medium" : insight.priority}
        </Badge>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <Badge variant="secondary" className="font-normal">
          {CATEGORY_LABELS[insight.category]}
        </Badge>
        <ConfidenceBar value={insight.confidence} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <EvidenceBlock
          label="Your site"
          quote={insight.evidence.yourSite.quote}
          observation={insight.evidence.yourSite.observation}
        />
        {insight.evidence.competitor ? (
          <EvidenceBlock
            label={`Competitor: ${insight.evidence.competitor.name}`}
            quote={insight.evidence.competitor.quote}
            observation={insight.evidence.competitor.observation}
          />
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            No direct competitor comparison for this insight
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
        <div className="text-[10px] font-medium uppercase tracking-wider text-primary/70">
          Recommendation
        </div>
        <p className="mt-1 text-sm leading-relaxed">{insight.recommendation}</p>
      </div>
    </article>
  );
}

function EvidenceBlock({
  label,
  quote,
  observation,
}: {
  label: string;
  quote: string | null;
  observation: string;
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      {quote && (
        <blockquote className="mt-2 border-l-2 border-foreground/20 pl-2 text-xs italic text-foreground/90">
          &ldquo;{quote}&rdquo;
        </blockquote>
      )}
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {observation}
      </p>
    </div>
  );
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const toneClass =
    value >= 0.75
      ? "bg-green-500"
      : value >= 0.5
        ? "bg-amber-500"
        : "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-1.5">
      <span className="uppercase tracking-wider">confidence</span>
      <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full", toneClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular-nums">{pct}%</span>
    </div>
  );
}

function DontChange({ items }: { items: string[] }) {
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        Don&rsquo;t change
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-sm"
          >
            <span
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-green-500/20 flex items-center justify-center text-[10px] text-green-700 dark:text-green-400"
            >
              ✓
            </span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SitesGrid({
  user,
  competitors,
}: {
  user: SiteAnalysis | undefined;
  competitors: SiteAnalysis[];
}) {
  if (!user && competitors.length === 0) return null;
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        What was analyzed
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {user && <SitePanel site={user} role="user" />}
        {competitors.map((c) => (
          <SitePanel key={c.url} site={c} role="competitor" />
        ))}
      </div>
    </section>
  );
}

function SitePanel({
  site,
  role,
}: {
  site: SiteAnalysis;
  role: "user" | "competitor";
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card",
        role === "user" && "ring-1 ring-primary/30",
      )}
    >
      <div className="aspect-3/4 relative bg-muted overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={site.screenshotUrl}
          alt={`${site.name} landing page`}
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="font-medium text-sm truncate">{site.name}</div>
          {role === "user" && (
            <Badge className="text-[10px] px-1.5 py-0">You</Badge>
          )}
        </div>
        <a
          href={site.url}
          target="_blank"
          rel="noreferrer"
          className="block text-[11px] text-muted-foreground hover:text-foreground truncate"
        >
          {site.url.replace(/^https?:\/\//, "")}
        </a>
        <div className="pt-2 space-y-1.5 text-xs">
          {site.copy.headline && (
            <p className="font-medium line-clamp-2">
              &ldquo;{site.copy.headline}&rdquo;
            </p>
          )}
          <p className="text-muted-foreground line-clamp-3">
            {site.visual.overallImpression}
          </p>
        </div>
        <div className="pt-1 flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px] font-normal">
            CTA: {site.visual.cta.primaryText || "—"}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-normal">
            density: {site.visual.visualHierarchy.density}
          </Badge>
          <Badge variant="secondary" className="text-[10px] font-normal">
            social proof: {site.visual.socialProof.strength}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function CompetitorSources({
  competitors,
  failedCaptures,
}: {
  competitors: Report["competitors"];
  failedCaptures: FailedCapture[];
}) {
  const failedByUrl = new Map(failedCaptures.map((f) => [f.url, f]));
  return (
    <section>
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
        How we picked these competitors
      </h2>
      <ul className="mt-3 space-y-3">
        {competitors.map((c) => {
          const failure = failedByUrl.get(c.url);
          return (
            <li
              key={c.url}
              className={cn(
                "rounded-lg border p-4 text-sm",
                failure
                  ? "border-destructive/30 bg-destructive/5"
                  : "bg-card/50",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  {failure && (
                    <Badge
                      variant="outline"
                      className="border-destructive/30 bg-destructive/10 text-destructive/80 text-[10px] font-normal px-1.5 py-0"
                    >
                      {failure.reasonLabel}
                    </Badge>
                  )}
                </div>
                <a
                  href={c.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {c.url.replace(/^https?:\/\//, "")}
                </a>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {c.reasoning}
              </p>
              {failure && (
                <p className="mt-2 text-xs text-destructive/70">
                  Not included in the comparison — we couldn&rsquo;t capture
                  this site.{" "}
                  <span className="text-muted-foreground">
                    {shortenReason(failure.reason)}
                  </span>
                </p>
              )}
              {c.sourceUrls && c.sourceUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {c.sourceUrls.map((s) => (
                    <a
                      key={s}
                      href={s}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border bg-background px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      {(() => {
                        try {
                          return new URL(s).hostname.replace(/^www\./, "");
                        } catch {
                          return s;
                        }
                      })()}
                    </a>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function shortenReason(reason: string): string {
  const firstSentence = reason.split(/(?<=[.!?])\s/)[0] ?? reason;
  return firstSentence.length > 180
    ? firstSentence.slice(0, 177) + "…"
    : firstSentence;
}
