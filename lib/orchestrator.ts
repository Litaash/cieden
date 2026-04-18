import { nanoid } from 'nanoid';
import { findCompetitors } from '@/lib/agents/competitor-finder';
import { analyzeVisual } from '@/lib/agents/visual-analyst';
import { analyzeCopy } from '@/lib/agents/copy-analyst';
import { synthesize } from '@/lib/agents/synthesizer';
import { captureLanding, type CapturedSite } from '@/lib/services/firecrawl';
import {
  isBlobConfigured,
  uploadScreenshot,
  uploadReport,
} from '@/lib/services/blob';
import type {
  AnalyzeEvent,
  FailedCapture,
  FailureReasonCategory,
  Report,
  SiteAnalysis,
} from '@/lib/schemas';

export type Emit = (event: AnalyzeEvent) => void;

/**
 * Max parallel site analyses. With Gemini billing enabled (Tier 1) the
 * 20 RPM free-tier ceiling is lifted, so we can run all four sites' analyst
 * pairs simultaneously. With concurrency=4 we peak at ~8 in-flight analyst
 * calls, comfortably under paid limits while keeping total wall time low.
 */
const ANALYSIS_CONCURRENCY = 4;

interface CaptureResult {
  url: string;
  success: boolean;
  site?: CapturedSite;
  error?: string;
}

/** Capture a single site, converting thrown errors into tagged results. */
async function captureOne(url: string): Promise<CaptureResult> {
  try {
    const site = await captureLanding(url);
    return { url, success: true, site };
  } catch (err) {
    return {
      url,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Full-pipeline orchestrator.
 *
 * The `emit` callback is the one way the outside world learns about progress;
 * the API route turns these events into SSE frames.
 *
 * Key latency optimizations (from the slow, strictly-sequential MVP):
 *  1. Kick off the user's own capture in parallel with competitor research.
 *     findCompetitors takes 8-15s and we already know the user's URL — no
 *     need to idle Firecrawl while Gemini searches Google.
 *  2. Stream per-site analysis: fire visual+copy analysts the instant each
 *     capture lands, instead of waiting for the slowest site to finish.
 *  3. Run up to ANALYSIS_CONCURRENCY site pipelines in parallel (billing-
 *     enabled Gemini quota lets us push this to 4 safely).
 */
export async function runAnalysis(userUrl: string, emit: Emit): Promise<Report> {
  const reportId = nanoid(12);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Start the user's capture immediately. This overlaps Firecrawl's 20-60s
  // scrape with the 8-15s competitor research, and keeps the hot path (user
  // site analysis → synthesis) moving even if competitor picks take a while.
  const userCapturePromise = captureOne(userUrl);

  emit({
    type: 'status',
    step: 'competitors',
    message: 'Researching direct competitors via Google Search…',
  });

  const { competitors, userName } = await findCompetitors(userUrl);
  emit({ type: 'competitors', competitors });

  emit({
    type: 'status',
    step: 'capture',
    message: `Capturing screenshots for ${1 + competitors.length} sites…`,
  });

  // Now that we know the competitor URLs, fire their captures in parallel
  // with the user capture we already have in flight.
  const competitorCapturePromises = competitors.map((c) => captureOne(c.url));

  const siteMeta: {
    url: string;
    name: string;
    isUser: boolean;
    capturePromise: Promise<CaptureResult>;
  }[] = [
    {
      url: userUrl,
      name: userName,
      isUser: true,
      capturePromise: userCapturePromise,
    },
    ...competitors.map((c, i) => ({
      url: c.url,
      name: c.name,
      isUser: false,
      capturePromise: competitorCapturePromises[i]!,
    })),
  ];

  const failedCaptures: FailedCapture[] = [];
  let primaryCaptureError: string | null = null;
  const analysisGate = makeSemaphore(ANALYSIS_CONCURRENCY);

  // Switch the client-visible step to "analyze" up front — the first analyst
  // call will fire as soon as the first capture resolves, which may be before
  // the slowest capture is done. The progress bar's sub-progress logic
  // handles the fact that capture/analyze now overlap.
  let analyzeStepAnnounced = false;
  const announceAnalyze = () => {
    if (analyzeStepAnnounced) return;
    analyzeStepAnnounced = true;
    emit({
      type: 'status',
      step: 'analyze',
      message: `Running visual + copy analysis (concurrency ${ANALYSIS_CONCURRENCY})…`,
    });
  };

  const sitePipelines: Promise<SiteAnalysis | null>[] = siteMeta.map(
    async (meta): Promise<SiteAnalysis | null> => {
      const res = await meta.capturePromise;

      if (!res.success || !res.site) {
        const reason = res.error ?? 'unknown error';
        if (meta.isUser) primaryCaptureError = reason;
        console.error(
          `[orchestrator] capture failed for ${meta.url} (isUser=${meta.isUser}): ${reason}`,
        );
        const failure: FailedCapture = {
          url: meta.url,
          name: meta.name,
          isUser: meta.isUser,
          reason,
          ...classifyFailure(reason),
        };
        failedCaptures.push(failure);
        emit({
          type: 'siteFailed',
          url: meta.url,
          name: meta.name,
          failure,
        });
        return null;
      }

      const captured = res.site;
      const slug = slugify(meta.name || meta.url);
      let screenshotUrl: string;
      if (isBlobConfigured()) {
        try {
          screenshotUrl = await uploadScreenshot({
            reportId,
            siteSlug: slug,
            bytes: captured.screenshot,
            mimeType: captured.screenshotMimeType,
          });
        } catch {
          emit({
            type: 'status',
            step: 'capture',
            message: `Blob upload failed for ${meta.name}, using inline data URL`,
          });
          screenshotUrl = bytesToDataUrl(
            captured.screenshot,
            captured.screenshotMimeType,
          );
        }
      } else {
        screenshotUrl = bytesToDataUrl(
          captured.screenshot,
          captured.screenshotMimeType,
        );
      }

      emit({
        type: 'siteReady',
        url: meta.url,
        name: meta.name,
        screenshotUrl,
      });

      // Announce "analyze" right before we touch an analyst so the progress
      // bar moves into the analysis range the moment work actually begins.
      announceAnalyze();

      return analysisGate.run(async () => {
        const [visual, copy] = await Promise.all([
          analyzeVisual({
            screenshot: captured.screenshot,
            screenshotMimeType: captured.screenshotMimeType,
            siteName: meta.name,
            siteUrl: meta.url,
          }),
          analyzeCopy({
            markdown: captured.markdown,
            siteName: meta.name,
            siteUrl: meta.url,
          }),
        ]);
        const analysis: SiteAnalysis = {
          url: meta.url,
          name: meta.name,
          screenshotUrl,
          visual,
          copy,
        };
        emit({ type: 'siteAnalyzed', analysis });
        return analysis;
      });
    },
  );

  const settled = await Promise.all(sitePipelines);
  const analyses: SiteAnalysis[] = settled.filter(
    (a): a is SiteAnalysis => a !== null,
  );

  const userAnalysis = analyses.find((a) => a.url === userUrl);
  if (!userAnalysis) {
    const detail = primaryCaptureError
      ? ` Firecrawl error: ${primaryCaptureError}`
      : '';
    throw new Error(
      `Could not capture the primary site (${userUrl}). The site may be blocking scrapers, require login, or be temporarily down.${detail}`,
    );
  }
  const competitorAnalyses = analyses.filter((a) => a.url !== userUrl);

  emit({
    type: 'status',
    step: 'synthesize',
    message: 'Synthesizing prioritized, evidence-backed insights…',
  });

  const synthesis = await synthesize({ userAnalysis, competitorAnalyses });

  const report: Report = {
    id: reportId,
    userUrl,
    userName,
    competitors,
    analyses,
    failedCaptures: failedCaptures.filter((f) => !f.isUser),
    synthesis,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  let persistedId: string | null = null;
  if (isBlobConfigured()) {
    emit({
      type: 'status',
      step: 'persist',
      message: 'Saving shareable report…',
    });
    try {
      await uploadReport(report);
      persistedId = reportId;
    } catch {
      emit({
        type: 'status',
        step: 'persist',
        message: 'Blob persist failed; report is shown inline only.',
      });
    }
  }

  emit({ type: 'complete', reportId: persistedId, report });
  return report;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/https?:\/\//, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  const b64 = Buffer.from(bytes).toString('base64');
  return `data:${mime};base64,${b64}`;
}

/**
 * Classify a raw Firecrawl error string into a short, human-friendly label
 * and a machine-readable category. Keeps the UI clean (short badge text)
 * while preserving the full technical reason for power users / tooltips.
 */
function classifyFailure(reason: string): {
  reasonCategory: FailureReasonCategory;
  reasonLabel: string;
} {
  const lower = reason.toLowerCase();
  if (
    lower.includes('all scraping engines failed') ||
    lower.includes('blocking automated access') ||
    lower.includes('cloudflare') ||
    lower.includes('bot')
  ) {
    return {
      reasonCategory: 'blocked',
      reasonLabel: 'Blocked by bot protection',
    };
  }
  if (lower.includes('timed out') || lower.includes('timeout')) {
    return { reasonCategory: 'timeout', reasonLabel: 'Timed out' };
  }
  if (
    lower.includes('404') ||
    lower.includes("doesn't exist") ||
    lower.includes('not found')
  ) {
    return { reasonCategory: 'not_found', reasonLabel: 'Page not found' };
  }
  return { reasonCategory: 'other', reasonLabel: 'Capture failed' };
}

/**
 * Tiny semaphore: caps concurrent analyst runs so we don't spike past
 * Gemini's RPM even when all 4 captures land within a few seconds of
 * each other. Inline instead of pulling in p-limit for a single call site.
 */
function makeSemaphore(limit: number): { run: <T>(fn: () => Promise<T>) => Promise<T> } {
  let active = 0;
  const queue: (() => void)[] = [];
  const take = (): Promise<void> => {
    if (active < limit) {
      active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      queue.push(() => {
        active++;
        resolve();
      });
    });
  };
  const release = () => {
    active--;
    const next = queue.shift();
    if (next) next();
  };
  return {
    run: async <T>(fn: () => Promise<T>): Promise<T> => {
      await take();
      try {
        return await fn();
      } finally {
        release();
      }
    },
  };
}
