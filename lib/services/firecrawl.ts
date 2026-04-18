import { Firecrawl } from '@mendable/firecrawl-js';

/**
 * Thin wrapper around the Firecrawl v2 SDK.
 *
 * Responsibilities:
 *  - Centralize API-key reading (never access env outside service modules).
 *  - Normalize the shape we actually need: { markdown, screenshotDataUrl, title, description }.
 *  - Hide v2-specific `formats` array noise from call-sites.
 */

export interface CapturedSite {
  url: string;
  title: string;
  description: string;
  markdown: string;
  /** Data URL (base64) or hosted URL — Firecrawl returns whichever is configured. */
  screenshot: string;
}

let client: Firecrawl | null = null;

function getClient(): Firecrawl {
  if (!client) {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) {
      throw new Error(
        'FIRECRAWL_API_KEY is not set. Get a free key at https://firecrawl.dev and add it to .env.local',
      );
    }
    client = new Firecrawl({ apiKey });
  }
  return client;
}

/**
 * Capture a landing page: markdown for copy analysis + full-page screenshot for vision.
 *
 * We use `onlyMainContent: false` because landing pages often rely on headers,
 * footers, and announcement bars we actually want to analyze.
 *
 * `fullPage: true` is critical — most SaaS landing pages hide key sections
 * (pricing, social proof, FAQ) below the fold.
 */
export async function captureLanding(url: string): Promise<CapturedSite> {
  const fc = getClient();
  const doc = await fc.scrape(url, {
    formats: [
      'markdown',
      { type: 'screenshot', fullPage: true, quality: 75 },
    ],
    onlyMainContent: false,
    blockAds: true,
    timeout: 60_000,
    // stealth proxy reduces blocks on Cloudflare-protected SaaS sites
    proxy: 'auto',
  });

  const screenshot = doc.screenshot;
  if (!screenshot) {
    throw new Error(`Firecrawl returned no screenshot for ${url}`);
  }

  return {
    url,
    title: doc.metadata?.title || doc.metadata?.ogTitle || '',
    description: doc.metadata?.description || doc.metadata?.ogDescription || '',
    markdown: doc.markdown || '',
    screenshot,
  };
}
