import { put, list } from '@vercel/blob';
import type { Report } from '@/lib/schemas';

/**
 * Vercel Blob adapter.
 *
 * Blob is optional — if `BLOB_READ_WRITE_TOKEN` is unset we degrade gracefully:
 * reports are streamed back to the client but not persisted to a shareable URL.
 * This keeps local dev frictionless: zero infra to run the app once API keys
 * are in place.
 */

export function isBlobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/**
 * Upload a base64 screenshot (data URL or raw base64) to Blob and return the
 * public URL. A 24h implicit TTL is expected; Vercel Cron purges reports
 * older than 24h in production. Filename includes the report id to keep
 * cleanup straightforward.
 */
export async function uploadScreenshot(
  reportId: string,
  siteSlug: string,
  screenshot: string,
): Promise<string> {
  const base64 = screenshot.startsWith('data:')
    ? (screenshot.split(',')[1] ?? '')
    : screenshot;
  const buf = Buffer.from(base64, 'base64');
  const { url } = await put(`reports/${reportId}/${siteSlug}.jpg`, buf, {
    access: 'public',
    contentType: 'image/jpeg',
    addRandomSuffix: false,
    allowOverwrite: true,
  });
  return url;
}

export async function uploadReport(report: Report): Promise<string> {
  const { url } = await put(
    `reports/${report.id}/report.json`,
    JSON.stringify(report),
    {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    },
  );
  return url;
}

/**
 * Fetch a previously persisted report by id. Uses Blob's `list()` with a
 * prefix so we never need to hardcode the store's public URL base.
 *
 * Returns null when Blob is not configured, the report is missing, or expired.
 */
export async function fetchReport(id: string): Promise<Report | null> {
  if (!isBlobConfigured()) return null;
  try {
    const { blobs } = await list({ prefix: `reports/${id}/` });
    const manifest = blobs.find((b) => b.pathname.endsWith('/report.json'));
    if (!manifest) return null;
    const res = await fetch(manifest.url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Report;
  } catch {
    return null;
  }
}
