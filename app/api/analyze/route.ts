import { NextRequest } from 'next/server';
import { z } from 'zod';
import { runAnalysis } from '@/lib/orchestrator';
import { assertGeminiConfigured } from '@/lib/services/gemini';
import type { AnalyzeEvent } from '@/lib/schemas';

/**
 * SSE-over-POST endpoint.
 *
 * We use POST (with text/event-stream content-type on the response) instead
 * of a traditional EventSource because we want the user URL in the request
 * body, and EventSource only supports GET. The client consumes the body via
 * fetch + ReadableStream — same wire format as SSE.
 *
 * Long-running: a full 4-site analysis takes ~30-90s. Vercel Functions default
 * to 10s on Hobby / 60s-300s on Pro depending on plan — we request the max
 * here via `maxDuration`.
 */
export const runtime = 'nodejs';
export const maxDuration = 300;

const RequestSchema = z.object({
  url: z
    .string()
    .url({ message: 'Please provide a valid URL, e.g. https://apollo.io' }),
});

export async function POST(req: NextRequest) {
  let userUrl: string;
  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);
    userUrl = normalizeUrl(parsed.url);
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Bad request' },
      { status: 400 },
    );
  }

  try {
    assertGeminiConfigured();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Server not configured' },
      { status: 500 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AnalyzeEvent) => {
        const payload = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        await runAnalysis(userUrl, send);
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

function normalizeUrl(input: string): string {
  try {
    const u = new URL(input);
    u.hash = '';
    u.search = '';
    return u.toString().replace(/\/$/, '');
  } catch {
    return input;
  }
}
