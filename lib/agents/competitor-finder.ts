import { generateText, generateObject } from 'ai';
import {
  geminiFlash,
  googleSearchTool,
  ANALYSIS_TEMPERATURE,
} from '@/lib/services/gemini';
import {
  CompetitorListSchema,
  type Competitor,
} from '@/lib/schemas';

/**
 * Competitor Finder agent.
 *
 * We deliberately do this in two steps:
 *
 *   1. Grounded search: let Gemini use the built-in google_search tool to
 *      research real-time competitor data for the given URL and produce a
 *      free-text explanation with source citations.
 *
 *   2. Structured extraction: a second, ungrounded Flash call normalizes that
 *      research text into our strict Zod-validated schema.
 *
 * Two reasons for the split:
 *   - Gemini currently can't combine `google_search` with a response schema
 *     in a single call (provider limitation).
 *   - Keeping the "thinking" step free-text preserves the model's reasoning
 *     richness, which we lose when forcing structured output on the same call.
 *
 * The prompt explicitly asks for *direct* competitors (same buyer, same
 * problem) — the common failure mode is getting adjacent tools in the same
 * broad category, which degrades the whole report.
 */
export async function findCompetitors(
  userUrl: string,
  opts: { count?: number } = {},
): Promise<{ competitors: Competitor[]; userName: string }> {
  const count = opts.count ?? 3;

  const research = await generateText({
    model: geminiFlash,
    temperature: ANALYSIS_TEMPERATURE,
    maxRetries: 4,
    tools: { google_search: googleSearchTool },
    prompt: `You are a senior SaaS product researcher. Identify the ${count} most DIRECT competitors of the landing page at ${userUrl}.

"Direct competitor" means: sells to the same buyer persona AND solves the same core problem. Adjacent tools in the same broad category DO NOT count.

Research process:
1. Use google_search to learn what ${userUrl} actually does and who they sell to. Read about their product category, ideal customer profile, and core use cases.
2. Use google_search to find companies that compete for the same buyers. Reference sources like G2, Capterra, product comparison articles, and "X vs Y" posts.
3. Reject companies that are adjacent but not direct (e.g. a CRM is not a direct competitor to a sales-intelligence tool, even if both are in "sales").

For each competitor, produce:
- Name
- Root landing-page URL (homepage, not a specific feature page)
- One-sentence justification referencing the shared buyer or problem
- 1-3 source URLs from your research that support the pick

Also identify the PRODUCT NAME of ${userUrl} itself (e.g. "Apollo.io", "Linear", "HubSpot") for downstream reporting.

Output as plain text, clearly structured. Example:

User product: Apollo.io

Competitors:

1. Lusha — https://lusha.com
   Reason: targets the same outbound SDR / RevOps buyer looking for B2B contact data and enrichment, overlapping with Apollo's core "find verified email / phone" use case.
   Sources: https://www.g2.com/compare/apollo-io-vs-lusha, https://lusha.com/blog/apollo-alternatives

2. ...`,
  });

  const extraction = await generateObject({
    model: geminiFlash,
    temperature: 0,
    maxRetries: 4,
    schema: CompetitorListSchema.extend({
      userName: CompetitorListSchema.shape.competitors.element.shape.name,
    }),
    prompt: `From the research notes below, extract the structured data:

- userName: the product name of the user's site at ${userUrl}
- competitors: the list of direct competitors (exactly ${count} if available)

Research notes:
"""
${research.text}
"""`,
  });

  return {
    competitors: extraction.object.competitors.slice(0, count),
    userName: extraction.object.userName,
  };
}
