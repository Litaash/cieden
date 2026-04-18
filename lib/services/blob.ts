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
 * Upload screenshot bytes to Blob and return the public URL. A 24h implicit
 * TTL is expected; Vercel Cron purges reports older than 24h in production.
 * Filename includes the report id to keep cleanup straightforward.
 */
export async function uploadScreenshot(args: {
  reportId: string;
  siteSlug: string;
  bytes: Uint8Array;
  mimeType: string;
}): Promise<string> {
  const { reportId, siteSlug, bytes, mimeType } = args;
  const extension = mimeTypeToExtension(mimeType);
  const { url } = await put(
    `reports/${reportId}/${siteSlug}.${extension}`,
    Buffer.from(bytes),
    {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: false,
      allowOverwrite: true,
    },
  );
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

function mimeTypeToExtension(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/png':
    default:
      return 'png';
  }
}
