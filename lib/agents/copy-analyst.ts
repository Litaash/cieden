import { generateObject } from 'ai';
import { geminiFlash, ANALYSIS_TEMPERATURE } from '@/lib/services/gemini';
import { CopyAnalysisSchema, type CopyAnalysis } from '@/lib/schemas';

/**
 * Copy Analyst agent.
 *
 * Text-only analysis of the page's markdown. Flash is sufficient — this is a
 * straightforward reading-and-extraction task, no visual reasoning needed.
 *
 * We cap input at ~12k chars to stay well inside Flash's context window and
 * keep costs predictable. Landing pages rarely benefit from analyzing the
 * 20th FAQ item — the top of the page is where the value prop lives.
 */
const MAX_MARKDOWN_CHARS = 12_000;

export async function analyzeCopy(args: {
  markdown: string;
  siteName: string;
  siteUrl: string;
}): Promise<CopyAnalysis> {
  const { markdown, siteName, siteUrl } = args;
  const trimmed = markdown.slice(0, MAX_MARKDOWN_CHARS);

  const { object } = await generateObject({
    model: geminiFlash,
    temperature: ANALYSIS_TEMPERATURE,
    schema: CopyAnalysisSchema,
    system:
      'You are a senior product marketing lead analyzing SaaS landing pages. You read carefully and quote verbatim. You never invent text that is not in the source material. If the page does not clearly state something, you leave that field null or say so explicitly.',
    prompt: `Analyze the landing-page copy for ${siteName} (${siteUrl}).

Extract:
- headline: the exact H1 / hero headline, verbatim, or null if not clearly identifiable
- subheadline: the supporting hero line, verbatim, or null
- valueProposition: your synthesis of what the product promises in one sentence, in the team's own words (not marketer boilerplate)
- toneOfVoice: 2-4 words, e.g. "confident, technical", "enterprise, formal", "playful, developer-native"
- differentiators: the specific claims the page uses to set itself apart (not generic "fast, reliable, secure")
- targetAudience: who the copy speaks to, as specifically as the page reveals

Source markdown (may be truncated):
"""
${trimmed}
"""`,
  });

  return object;
}
