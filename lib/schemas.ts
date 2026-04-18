import { z } from 'zod';

/**
 * Core domain schemas.
 *
 * Two roles:
 *  1. Validate AI structured outputs (via `generateObject`).
 *  2. Act as the single source of truth for the report data model.
 *
 * Every AI-originated insight must carry evidence — that's the core
 * anti-generic-advice guarantee described in the PRD.
 */

export const CompetitorSchema = z.object({
  name: z.string().describe('Short brand / product name, e.g. "Lusha"'),
  url: z.string().describe('Root URL of the competitor landing page'),
  reasoning: z
    .string()
    .describe(
      'One-sentence justification for why this company competes with the user site. Must reference the shared buyer or problem, not just "similar industry".',
    ),
  sourceUrls: z
    .array(z.string())
    .default([])
    .describe('Citation URLs supporting this choice (e.g. G2, Capterra, review articles)'),
});
export type Competitor = z.infer<typeof CompetitorSchema>;

export const CompetitorListSchema = z.object({
  competitors: z.array(CompetitorSchema).min(1).max(5),
});

/** Canonical design dimensions the system analyzes. */
export const InsightCategorySchema = z.enum([
  'hero',
  'cta',
  'social_proof',
  'hierarchy',
  'copy',
]);
export type InsightCategory = z.infer<typeof InsightCategorySchema>;

/** Visual analysis produced from a screenshot. */
export const VisualAnalysisSchema = z.object({
  hero: z.object({
    description: z
      .string()
      .describe('What the hero section looks like: layout, color, imagery, typography.'),
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
  }),
  cta: z.object({
    primaryText: z
      .string()
      .describe('Exact label of the primary call-to-action button as seen on screen.'),
    placement: z
      .string()
      .describe('Where on the page the primary CTA appears (e.g. "hero right, above the fold")'),
    visibility: z
      .string()
      .describe('How conspicuous the CTA is (color contrast, size, whitespace).'),
    notes: z
      .string()
      .describe('Any extra context — secondary CTAs, friction, stickiness, etc.'),
  }),
  visualHierarchy: z.object({
    description: z.string(),
    density: z
      .enum(['low', 'medium', 'high'])
      .describe('Perceived information density above the fold.'),
  }),
  socialProof: z.object({
    signals: z
      .array(z.string())
      .describe('List of social-proof elements visible: logos, testimonials, stats, review badges.'),
    strength: z.enum(['none', 'weak', 'medium', 'strong']),
  }),
  overallImpression: z.string().describe('One paragraph summary from a senior designer POV.'),
});
export type VisualAnalysis = z.infer<typeof VisualAnalysisSchema>;

/** Copy / text-level analysis derived from page markdown. */
export const CopyAnalysisSchema = z.object({
  headline: z.string().nullable().describe('Primary H1 or hero headline, verbatim.'),
  subheadline: z.string().nullable(),
  valueProposition: z
    .string()
    .describe('What the user promises in one sentence, in the product team\'s words.'),
  toneOfVoice: z
    .string()
    .describe('E.g. "confident, technical", "playful, marketing-y", "enterprise, formal".'),
  differentiators: z.array(z.string()),
  targetAudience: z.string(),
});
export type CopyAnalysis = z.infer<typeof CopyAnalysisSchema>;

/** Per-site combined analysis (input into the Synthesizer). */
export const SiteAnalysisSchema = z.object({
  url: z.string(),
  name: z.string(),
  screenshotUrl: z.string().describe('Signed / blob URL for the captured screenshot'),
  visual: VisualAnalysisSchema,
  copy: CopyAnalysisSchema,
});
export type SiteAnalysis = z.infer<typeof SiteAnalysisSchema>;

/** A single actionable insight. */
export const InsightSchema = z.object({
  claim: z.string().describe('The recommendation, specific and actionable.'),
  category: InsightCategorySchema,
  priority: z.enum(['high', 'med', 'low']),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('0-1 how confident the model is. <0.5 means "possible but not certain".'),
  evidence: z.object({
    yourSite: z.object({
      quote: z
        .string()
        .nullable()
        .describe('Verbatim text from the user\'s page supporting the claim, if any.'),
      observation: z
        .string()
        .describe(
          'What was observed on the user\'s page — specific element, color, layout, or copy.',
        ),
    }),
    competitor: z
      .object({
        name: z.string(),
        quote: z.string().nullable(),
        observation: z.string(),
      })
      .nullable()
      .describe('Optional competitor comparison supporting the claim.'),
  }),
  recommendation: z.string().describe('Concrete change the user should consider.'),
});
export type Insight = z.infer<typeof InsightSchema>;

export const SynthesisSchema = z.object({
  insights: z.array(InsightSchema).min(1).max(15),
  topRecommendations: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe('Top 3 prioritized changes, each one sentence, referencing specifics.'),
  dontChange: z
    .array(z.string())
    .default([])
    .describe('Strengths the user should keep, so recommendations don\'t erase what works.'),
});
export type Synthesis = z.infer<typeof SynthesisSchema>;

/**
 * A short, human-friendly categorization of why a capture failed. We keep the
 * full Firecrawl error string alongside for power users / debugging.
 */
export const FailureReasonCategorySchema = z.enum([
  'blocked', // bot protection / Cloudflare / scraping engines refused
  'timeout', // page did not finish loading within the budget
  'not_found', // 404 / invalid URL
  'other',
]);
export type FailureReasonCategory = z.infer<typeof FailureReasonCategorySchema>;

export const FailedCaptureSchema = z.object({
  url: z.string(),
  name: z.string(),
  isUser: z.boolean(),
  reason: z.string().describe('Raw error text from Firecrawl (for details/tooltip).'),
  reasonCategory: FailureReasonCategorySchema,
  reasonLabel: z
    .string()
    .describe('Short human label, e.g. "Blocked by bot protection".'),
});
export type FailedCapture = z.infer<typeof FailedCaptureSchema>;

/** Persisted report shape. */
export const ReportSchema = z.object({
  id: z.string(),
  userUrl: z.string(),
  userName: z.string(),
  competitors: z.array(CompetitorSchema),
  analyses: z.array(SiteAnalysisSchema),
  failedCaptures: z.array(FailedCaptureSchema).default([]),
  synthesis: SynthesisSchema,
  createdAt: z.string(),
  expiresAt: z.string(),
});
export type Report = z.infer<typeof ReportSchema>;

/** SSE event shape. */
export type AnalyzeEvent =
  | { type: 'status'; step: string; message: string }
  | { type: 'competitors'; competitors: Competitor[] }
  | { type: 'siteReady'; url: string; name: string; screenshotUrl: string }
  | { type: 'siteFailed'; url: string; name: string; failure: FailedCapture }
  | { type: 'siteAnalyzed'; analysis: SiteAnalysis }
  | { type: 'complete'; reportId: string | null; report: Report }
  | { type: 'error'; message: string };
