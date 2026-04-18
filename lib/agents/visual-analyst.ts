import { generateObject } from 'ai';
import { geminiPro, ANALYSIS_TEMPERATURE } from '@/lib/services/gemini';
import { VisualAnalysisSchema, type VisualAnalysis } from '@/lib/schemas';

/**
 * Visual Analyst agent.
 *
 * Takes a full-page screenshot (raw bytes) and produces a structured visual
 * critique.
 *
 * Prompt design choices:
 *  - Uses senior-designer framing ("You are a senior product designer...") to
 *    bias the model toward design-literate language (hierarchy, whitespace,
 *    cognitive load) rather than generic SEO-speak.
 *  - Demands verbatim text for the CTA label to prevent hallucinated copy —
 *    one of the common failure modes from the PRD's "what good looks like"
 *    section.
 *  - Keeps temperature low; visual analysis is not a creative task.
 */
export async function analyzeVisual(args: {
  screenshot: Uint8Array;
  screenshotMimeType: string;
  siteName: string;
  siteUrl: string;
}): Promise<VisualAnalysis> {
  const { screenshot, screenshotMimeType, siteName, siteUrl } = args;

  const { object } = await generateObject({
    model: geminiPro,
    temperature: ANALYSIS_TEMPERATURE,
    // Bumped above SDK default (2) so the exponential-backoff retries cover
    // the ~60s window needed for Gemini's free-tier RPM to recover on 429.
    maxRetries: 4,
    schema: VisualAnalysisSchema,
    messages: [
      {
        role: 'system',
        content:
          'You are a senior product designer critiquing SaaS landing pages. You speak in specific, concrete, design-literate terms (hierarchy, contrast, whitespace, cognitive load, scanability). You never offer generic advice. When you describe a CTA, you quote its exact label from the image. When you describe the hero, you mention real colors, typography, and layout you can see. If something is not clearly visible, you say so instead of guessing.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze the full-page landing page screenshot for ${siteName} (${siteUrl}).

Focus on:
- HERO: the above-the-fold section. What's the headline, imagery, layout? What works, what doesn't?
- CTA: the primary call-to-action. Quote the exact button label. Describe color, placement, contrast, size relative to other elements.
- VISUAL HIERARCHY: how the page guides the eye. Is information density high or low above the fold?
- SOCIAL PROOF: testimonials, logos, ratings, stats — list what you can actually see.
- OVERALL: one paragraph summary in the voice of a design crit.

Be specific. "The CTA 'Start Free' is orange on white, right-aligned in the hero, with a secondary 'Book Demo' ghost button beside it" is good. "The CTA is prominent" is not.`,
          },
          {
            type: 'image',
            image: screenshot,
            mediaType: screenshotMimeType,
          },
        ],
      },
    ],
  });

  return object;
}
