import { captureLanding, type CapturedSite } from '@/lib/services/firecrawl';

/**
 * Scraper agent.
 *
 * Thin wrapper that runs captures in parallel and tolerates individual failures.
 * A failed competitor capture shouldn't kill the whole run — per PRD:
 * "Mitigation: Firecrawl handles most; we surface graceful fallbacks".
 */

export interface CaptureResult {
  url: string;
  success: boolean;
  site?: CapturedSite;
  error?: string;
}

export async function captureAll(urls: string[]): Promise<CaptureResult[]> {
  return Promise.all(
    urls.map(async (url) => {
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
    }),
  );
}
