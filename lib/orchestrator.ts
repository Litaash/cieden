import { nanoid } from 'nanoid';
import { findCompetitors } from '@/lib/agents/competitor-finder';
import { captureAll } from '@/lib/agents/scraper';
import { analyzeVisual } from '@/lib/agents/visual-analyst';
import { analyzeCopy } from '@/lib/agents/copy-analyst';
import { synthesize } from '@/lib/agents/synthesizer';
import {
  isBlobConfigured,
  uploadScreenshot,
  uploadReport,
} from '@/lib/services/blob';
import type { AnalyzeEvent, Report, SiteAnalysis } from '@/lib/schemas';
import type { CapturedSite } from '@/lib/services/firecrawl';

export type Emit = (event: AnalyzeEvent) => void;

/**
 * Full-pipeline orchestrator.
 *
 * The `emit` callback is the one way the outside world learns about progress;
 * the API route turns these events into SSE frames.
 *
 * Design notes:
 *  - Parallelism where safe: capture, per-site analysis.
 *  - Tolerant to competitor failures: the synthesizer still runs with
 *    whatever competitor data is available (down to zero in the worst case,
 *    which is still a useful "your landing page" critique).
 *  - Blob is optional: when the token is absent we inline screenshots as
 *    data URLs on the report so the UI can render them without persistence.
 */
export async function runAnalysis(userUrl: string, emit: Emit): Promise<Report> {
  const reportId = nanoid(12);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  emit({
    type: 'status',
    step: 'competitors',
    message: 'Researching direct competitors via Google Search…',
  });

  const { competitors, userName } = await findCompetitors(userUrl);
  emit({ type: 'competitors', competitors });

  const sitesToCapture: { url: string; name: string; isUser: boolean }[] = [
    { url: userUrl, name: userName, isUser: true },
    ...competitors.map((c) => ({ url: c.url, name: c.name, isUser: false })),
  ];

  emit({
    type: 'status',
    step: 'capture',
    message: `Capturing screenshots for ${sitesToCapture.length} sites…`,
  });

  const captureResults = await captureAll(sitesToCapture.map((s) => s.url));

  // For each captured site we produce a displayable URL (Blob URL when
  // configured; inline data URL otherwise) plus keep the raw bytes for the
  // Visual Analyst.
  const captured: {
    url: string;
    name: string;
    isUser: boolean;
    site: CapturedSite;
    screenshotUrl: string;
  }[] = [];

  for (const [i, res] of captureResults.entries()) {
    const meta = sitesToCapture[i];
    if (!meta) continue;
    if (!res.success || !res.site) {
      emit({
        type: 'status',
        step: 'capture',
        message: `Could not capture ${meta.url}: ${res.error ?? 'unknown error'}`,
      });
      continue;
    }

    const slug = slugify(meta.name || meta.url);
    let screenshotUrl: string;
    if (isBlobConfigured()) {
      try {
        screenshotUrl = await uploadScreenshot({
          reportId,
          siteSlug: slug,
          bytes: res.site.screenshot,
          mimeType: res.site.screenshotMimeType,
        });
      } catch {
        emit({
          type: 'status',
          step: 'capture',
          message: `Blob upload failed for ${meta.name}, using inline data URL`,
        });
        screenshotUrl = bytesToDataUrl(
          res.site.screenshot,
          res.site.screenshotMimeType,
        );
      }
    } else {
      screenshotUrl = bytesToDataUrl(
        res.site.screenshot,
        res.site.screenshotMimeType,
      );
    }

    captured.push({
      url: meta.url,
      name: meta.name,
      isUser: meta.isUser,
      site: res.site,
      screenshotUrl,
    });

    emit({
      type: 'siteReady',
      url: meta.url,
      name: meta.name,
      screenshotUrl,
    });
  }

  const userEntry = captured.find((c) => c.isUser);
  if (!userEntry) {
    throw new Error(
      'Could not capture the primary site. Check the URL and try again.',
    );
  }

  emit({
    type: 'status',
    step: 'analyze',
    message: 'Running visual + copy analysis in parallel…',
  });

  const analyses: SiteAnalysis[] = await Promise.all(
    captured.map(async (c): Promise<SiteAnalysis> => {
      const [visual, copy] = await Promise.all([
        analyzeVisual({
          screenshot: c.site.screenshot,
          screenshotMimeType: c.site.screenshotMimeType,
          siteName: c.name,
          siteUrl: c.url,
        }),
        analyzeCopy({
          markdown: c.site.markdown,
          siteName: c.name,
          siteUrl: c.url,
        }),
      ]);
      const analysis: SiteAnalysis = {
        url: c.url,
        name: c.name,
        screenshotUrl: c.screenshotUrl,
        visual,
        copy,
      };
      emit({ type: 'siteAnalyzed', analysis });
      return analysis;
    }),
  );

  emit({
    type: 'status',
    step: 'synthesize',
    message: 'Synthesizing prioritized, evidence-backed insights…',
  });

  const userAnalysis = analyses.find((a) => a.url === userUrl);
  const competitorAnalyses = analyses.filter((a) => a.url !== userUrl);
  if (!userAnalysis) throw new Error('User analysis missing after capture');

  const synthesis = await synthesize({ userAnalysis, competitorAnalyses });

  const report: Report = {
    id: reportId,
    userUrl,
    userName,
    competitors,
    analyses,
    synthesis,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  let persistedId: string | null = null;
  if (isBlobConfigured()) {
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
