import { Firecrawl } from '@mendable/firecrawl-js';

/**
 * Thin wrapper around the Firecrawl v2 SDK.
 *
 * Responsibilities:
 *  - Centralize API-key reading (never access env outside service modules).
 *  - Normalize the shape we actually need: { markdown, screenshot bytes, title,
 *    description }.
 *  - Hide v2-specific `formats` array noise from call-sites.
 *
 * Screenshot normalization:
 *  Firecrawl v2 returns the screenshot as EITHER:
 *    - a hosted Google Cloud Storage URL (most common path today), OR
 *    - a base64 data URL / raw base64 string (older responses or fallback).
 *  We always coerce to a Uint8Array so every downstream consumer
 *  (Gemini Vision, Vercel Blob, inline-display encoder) can take one input shape.
 */

export interface CapturedSite {
  url: string;
  title: string;
  description: string;
  markdown: string;
  /** Raw JPEG bytes — consumers can upload, send to LLMs, or base64 encode for inline display. */
  screenshot: Uint8Array;
  /** MIME type of the captured screenshot. Firecrawl v2 uses PNG today. */
  screenshotMimeType: string;
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
  // Timeout notes:
  //  - Heavy SaaS landing pages with Cloudflare / bot-detection routinely take
  //    60-120s through Firecrawl's stealth proxy. 180s gives us headroom while
  //    still fitting inside the Vercel function maxDuration (300s) when 4 sites
  //    run in parallel.
  //  - `waitFor: 2000` — let hero animations, client-side redirects and late
  //    hydration finish before the screenshot is taken; without it we sometimes
  //    capture loading skeletons.
  const doc = await fc.scrape(url, {
    formats: [
      'markdown',
      { type: 'screenshot', fullPage: true, quality: 75 },
    ],
    onlyMainContent: false,
    blockAds: true,
    timeout: 180_000,
    waitFor: 2000,
    // stealth proxy reduces blocks on Cloudflare-protected SaaS sites
    proxy: 'auto',
  });

  const rawScreenshot = doc.screenshot;
  if (!rawScreenshot) {
    throw new Error(`Firecrawl returned no screenshot for ${url}`);
  }

  const { bytes, mime } = await toBytes(rawScreenshot);

  return {
    url,
    title: doc.metadata?.title || doc.metadata?.ogTitle || '',
    description: doc.metadata?.description || doc.metadata?.ogDescription || '',
    markdown: doc.markdown || '',
    screenshot: bytes,
    screenshotMimeType: mime,
  };
}

async function toBytes(
  input: string,
): Promise<{ bytes: Uint8Array; mime: string }> {
  if (input.startsWith('data:')) {
    const match = /^data:([^;]+);base64,([\s\S]*)$/.exec(input);
    if (!match) throw new Error('Malformed data: URL from Firecrawl');
    const mime = match[1] ?? 'image/png';
    const b64 = match[2] ?? '';
    return { bytes: new Uint8Array(Buffer.from(b64, 'base64')), mime };
  }

  if (input.startsWith('http://') || input.startsWith('https://')) {
    const res = await fetch(input);
    if (!res.ok) {
      throw new Error(
        `Failed to download Firecrawl screenshot (${res.status}): ${input}`,
      );
    }
    const mime = res.headers.get('content-type') || guessMimeFromUrl(input);
    const buf = new Uint8Array(await res.arrayBuffer());
    return { bytes: buf, mime };
  }

  // Assume raw base64 without data-URL prefix.
  return {
    bytes: new Uint8Array(Buffer.from(input, 'base64')),
    mime: 'image/png',
  };
}

function guessMimeFromUrl(url: string): string {
  const lower = url.toLowerCase().split('?')[0] ?? '';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}
