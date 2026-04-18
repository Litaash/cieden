import { google } from '@ai-sdk/google';

/**
 * Gemini model factories.
 *
 * We expose two tiers:
 *  - Flash for cheap, fast, high-volume work (competitor search, copy analysis, normalization).
 *  - Pro for multimodal reasoning (Vision analysis of screenshots).
 *
 * Default: both tiers point at `gemini-2.5-flash`. Google removed the
 * free-tier quota for `gemini-2.5-pro`, so defaulting to Pro makes the MVP
 * unusable without billing. Flash handles vision + structured output well
 * enough for an MVP critique; upgrade by setting GEMINI_PRO_MODEL when
 * billing is available.
 *
 * Model ids can be overridden via env to make it easy to swap in new models
 * without a code change (per the AGENTS.md note: Next.js 16 and its ecosystem
 * move fast and we want forward compatibility).
 */

const FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-2.5-flash';
const PRO_MODEL = process.env.GEMINI_PRO_MODEL || 'gemini-2.5-flash';

export const geminiFlash = google(FLASH_MODEL);
export const geminiPro = google(PRO_MODEL);

/**
 * Low temperature for analytical tasks to maximize determinism and minimize
 * creative drift. Raised only for generation-oriented callers if needed.
 */
export const ANALYSIS_TEMPERATURE = 0.2;

/** Built-in Google Search tool used for grounded competitor discovery. */
export const googleSearchTool = google.tools.googleSearch({});

export function assertGeminiConfigured(): void {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      'GOOGLE_GENERATIVE_AI_API_KEY is not set. Get a free key at https://aistudio.google.com/apikey and add it to .env.local',
    );
  }
}
