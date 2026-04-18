import { generateObject } from 'ai';
import { geminiPro, ANALYSIS_TEMPERATURE } from '@/lib/services/gemini';
import {
  SynthesisSchema,
  type SiteAnalysis,
  type Synthesis,
} from '@/lib/schemas';

/**
 * Synthesizer agent.
 *
 * Takes per-site analyses (user + N competitors) and produces evidence-backed,
 * prioritized insights plus a "don't change" list.
 *
 * Prompt design:
 *  - The input is fully text (we do NOT re-send screenshots here — we rely on
 *    the Visual Analyst's text summaries). This keeps the synthesis call cheap
 *    and contextually compact.
 *  - We explicitly enforce the evidence contract: every insight must reference
 *    a concrete observation from the user's site and (ideally) a named
 *    competitor. Insights without evidence are rejected by the schema.
 *  - We cap insights at 15 and top recommendations at 3 — per PRD, a focused
 *    trustworthy report beats a sprawling "audit checklist".
 */
export async function synthesize(args: {
  userAnalysis: SiteAnalysis;
  competitorAnalyses: SiteAnalysis[];
}): Promise<Synthesis> {
  const { userAnalysis, competitorAnalyses } = args;

  const serializeSite = (s: SiteAnalysis, role: 'USER' | 'COMPETITOR') => `
=== ${role}: ${s.name} (${s.url}) ===

VISUAL ANALYSIS:
Hero: ${s.visual.hero.description}
  Strengths: ${s.visual.hero.strengths.join('; ') || '—'}
  Weaknesses: ${s.visual.hero.weaknesses.join('; ') || '—'}
CTA: "${s.visual.cta.primaryText}"
  Placement: ${s.visual.cta.placement}
  Visibility: ${s.visual.cta.visibility}
  Notes: ${s.visual.cta.notes}
Visual hierarchy: ${s.visual.visualHierarchy.description} (density: ${s.visual.visualHierarchy.density})
Social proof: [${s.visual.socialProof.strength}] ${s.visual.socialProof.signals.join('; ') || 'none visible'}
Overall: ${s.visual.overallImpression}

COPY ANALYSIS:
Headline: ${s.copy.headline ?? '(not clearly identified)'}
Subheadline: ${s.copy.subheadline ?? '(not clearly identified)'}
Value proposition: ${s.copy.valueProposition}
Tone: ${s.copy.toneOfVoice}
Differentiators: ${s.copy.differentiators.join('; ') || '—'}
Audience: ${s.copy.targetAudience}
`;

  const userBlock = serializeSite(userAnalysis, 'USER');
  const competitorBlocks = competitorAnalyses
    .map((a) => serializeSite(a, 'COMPETITOR'))
    .join('\n');

  const { object } = await generateObject({
    model: geminiPro,
    temperature: ANALYSIS_TEMPERATURE,
    maxRetries: 4,
    schema: SynthesisSchema,
    system:
      'You are a senior product designer delivering a private design crit. You are specific, evidence-backed, and opinionated. You never issue generic advice ("improve your CTA"). Every insight references a concrete observation from the user\'s page and, where possible, a specific competitor by name. When you are not confident, you say so via confidence < 0.5 — you never fabricate details that are not in the source analyses.',
    prompt: `Compare the USER's landing page against the COMPETITORS and produce actionable insights.

Rules:
1. Every insight must carry evidence: specific observations (quoted copy, named UI element, named competitor) in the evidence field. If you cannot ground a claim in the analyses below, DO NOT include it.
2. Insights must be CATEGORIZED into one of: hero, cta, social_proof, hierarchy, copy.
3. Prioritize by estimated conversion impact × implementation effort. Mark 'high' for changes that are both high-impact and feasible.
4. Confidence scores must be honest. If the source analysis said something was "not clearly visible", your confidence drops.
5. Produce at most 15 insights. Pick the top 3 and list them separately as one-sentence directives in topRecommendations (each referencing specifics — e.g. "Replace the gray 'Request Demo' CTA with a high-contrast action label like Lusha's 'Start Free — No Credit Card'").
6. In dontChange, list 1-3 strengths the user should preserve, so the recommendations don't accidentally erase what works.

${userBlock}

${competitorBlocks}`,
  });

  return object;
}
