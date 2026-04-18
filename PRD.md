# Competitive Landing Page Analyzer — Product Requirements Document

> **Status:** v1.0 (MVP scope)
> **Author:** Oleksandr Litash
> **Last updated:** 2026-04-18

---

## 1. Problem Statement

### Who is this for?

- **Primary:** SaaS product teams — product managers, product designers, founders of early-to-mid-stage SaaS companies.
- **Secondary:** Marketing leads and growth designers responsible for landing-page conversion.

### What pain are we solving?

Every SaaS team periodically asks: _"How does our landing page compare to competitors?"_ Today, answering this question is painful:

1. **Manual and slow** — someone spends a day taking screenshots, writing notes in Notion, debating what "good design" means.
2. **Subjective and inconsistent** — two designers give different answers; the bias of whoever did the research leaks in.
3. **Never repeated** — done once, never refreshed, so the insights are stale within a quarter.
4. **Shallow output** — usually ends as a deck of screenshots with generic notes ("their hero is cleaner"), not actionable changes.

The result is most teams skip the exercise entirely and ship landing pages in a competitive vacuum.

### Why now?

- **Vision-capable LLMs** (Gemini 2.5, GPT-4o, Claude 4) can reason about layout, hierarchy, and visual decisions with surprisingly senior-designer-like output.
- **Grounded generation** (Gemini Grounding, web search tools) gives AI access to fresh competitor data.
- **Browser automation as a service** (Firecrawl, Browserbase) removed the engineering cost of reliable screenshots.

Three years ago this was a 6-engineer product. Today it's a weekend MVP. The window for a focused tool is open.

---

## 2. Jobs To Be Done

When a SaaS team hires this tool, they are trying to:

| JTBD                                                                                 | Success signal                                                          |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| **"Give me a credible second opinion on my landing page before I ship a redesign."** | User forwards the report to a designer or founder without editing it.   |
| **"Show me what competitors are doing differently, with evidence, not vibes."**      | Every insight references a specific screenshot crop + competitor quote. |
| **"Tell me what to change first, not everything at once."**                          | Report has a prioritized top-3 list, not 47 bullet points.              |
| **"Let me re-run this every quarter as competitors iterate."**                       | Users return to analyze the same URL again.                             |
| **"Help me convince stakeholders with data, not opinions."**                         | Report is shareable as a public link or PDF without rework.             |

---

## 3. Feature Set

### MUST-HAVE (MVP — this deliverable)

- **URL input** — single form, accepts any public SaaS landing page.
- **Automatic competitor discovery** — find 3 direct competitors via Gemini Grounding with cited sources.
- **Full-page screenshot capture** for user's site + each competitor (Firecrawl).
- **Multi-dimensional AI analysis** across 5 canonical design criteria:
  1. Hero & value proposition clarity
  2. Primary CTA (visibility, copy, placement)
  3. Social proof & credibility signals
  4. Visual hierarchy & information density
  5. Copy tone & differentiation
- **Evidence-backed insights** — every insight carries `{claim, evidence, confidence}` and links back to a screenshot region or exact copy quote.
- **Streaming progress UI** — user sees live status: _searching → capturing → analyzing → synthesizing_.
- **Prioritized recommendations** — top 3 changes ranked by estimated impact.
- **Shareable report page** — stable URL for the generated report.
- **No-auth flow** — works instantly, no signup friction.

### SHOULD-HAVE (next iteration)

- **Competitor edit step** — user reviews/replaces AI-picked competitors before analysis runs.
- **Section-level deep dives** — click a section of the screenshot to get focused critique.
- **PDF export** — one-click, brand-agnostic PDF for sharing.
- **"Why this competitor" justification** — explicit reasoning with source links for each competitor pick.
- **Analysis history (with auth)** — authenticated users see past runs.
- **Comparative metrics table** — quantitative side-by-side: word count, CTA count, image-to-text ratio.

### COULD-HAVE (full vision)

- **Temporal monitoring** — re-analyze a URL monthly, diff changes, alert on competitor pivots.
- **A/B recommendation mockups** — AI-generated Figma frames showing the proposed change.
- **Industry benchmark library** — aggregated anonymized data on what "good" looks like per SaaS category.
- **Figma plugin** — pull report findings directly into a design file as annotations.
- **Team workspaces** — multi-user accounts with comment threads on each insight.
- **Conversion-signal integration** — pair with analytics to correlate recommendations with actual lift.

---

## 4. Technical Approach

### Architecture overview

```
┌────────────┐      ┌─────────────────────────────────────────┐
│  Browser   │ ───▶ │  Next.js 16 App Router (Vercel)         │
│  (form)    │      │                                         │
└────────────┘      │  ┌────────────────────────────────────┐ │
       ▲            │  │ /api/analyze  (SSE streaming)      │ │
       │            │  │                                    │ │
       │  events    │  │  1. Competitor Finder  ──────┐     │ │
       │            │  │     (Gemini + Grounding)     │     │ │
       │            │  │                              ▼     │ │
       │            │  │  2. Scraper            Firecrawl   │ │
       │            │  │     (parallel, 4 sites)  API       │ │
       │            │  │                              │     │ │
       │            │  │  3a. Visual Analyst  ◀───────┤     │ │
       │            │  │     (Gemini Vision,                │ │
       │            │  │      per-site, per-section)        │ │
       │            │  │                                    │ │
       │            │  │  3b. Copy Analyst                  │ │
       │            │  │     (Gemini Flash on markdown)     │ │
       │            │  │                                    │ │
       │            │  │  4. Synthesizer                    │ │
       │            │  │     (Gemini Pro, structured)       │ │
       │            │  └────────────────────────────────────┘ │
       │            │                                         │
       │            │  /report/[id]   Vercel Blob (TTL 24h)   │
       └────────────┤     ▲                    │              │
                    │     │                    ▼              │
                    │     └─── stored report JSON + images   │
                    └─────────────────────────────────────────┘
```

### Stack & rationale

| Layer               | Choice                                 | Why                                                                                                                        |
| ------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Framework           | **Next.js 16 (App Router, Turbopack)** | Server Actions + streaming responses map cleanly to long-running AI work. React 19.2 `useActionState` fits progress flows. |
| Language            | **TypeScript**                         | Zod schemas for AI structured outputs demand strict typing end-to-end.                                                     |
| Styling             | **Tailwind v4 + shadcn/ui**            | Fast path to polished, accessible UI without custom design system overhead.                                                |
| AI — text reasoning | **Gemini 2.5 Flash**                   | Cheap, fast, generous free tier; handles competitor discovery, copy analysis, summarization.                               |
| AI — vision         | **Gemini 2.5 Pro**                     | Strong multimodal reasoning; one API surface across text + vision.                                                         |
| AI — search         | **Gemini Grounding**                   | Native Google-search grounding with source URLs — avoids paying for SerpAPI.                                               |
| AI orchestration    | **Vercel AI SDK v5**                   | Provider-agnostic `generateObject` with Zod schemas; streaming primitives for SSE.                                         |
| Web scraping        | **Firecrawl**                          | One API call returns screenshot + markdown + metadata. 500/mo free.                                                        |
| Storage             | **Vercel Blob**                        | Short-TTL signed URLs for screenshots. Satisfies "don't leave scraped pages public indefinitely."                          |
| Hosting             | **Vercel**                             | Native Next.js, Cron for TTL cleanup, Functions auto-scale.                                                                |
| State (MVP)         | **None (stateless per-request)**       | No database; each analysis is a self-contained run. Report persisted as a JSON blob alongside screenshots.                 |

### Key architectural decisions

**1. Multi-agent, not one megaprompt.**
Each step is a specialized call with a narrow prompt and structured output (Zod schema). This:

- Reduces hallucination (smaller cognitive load per call).
- Lets us parallelize (all 4 sites analyzed concurrently).
- Makes failures isolable and retryable.

**2. Section-based vision analysis.**
Full-page screenshots of modern SaaS landing pages are often 5000-10000px tall. Feeding the whole image to Gemini risks detail loss. We crop into semantic sections (hero, features, social proof, pricing, footer) based on Firecrawl's structured output, and analyze each separately. Synthesis is text-only.

**3. Evidence-first output contract.**
Every insight the system emits is forced through this schema:

```ts
{
  claim: string;              // the recommendation
  category: enum;             // one of the 5 criteria
  evidence: {
    yourSite: { quote?: string; screenshotCrop?: Rect };
    competitor?: { name: string; quote?: string; screenshotCrop?: Rect };
  };
  confidence: number;         // 0-1
  priority: 'high' | 'med' | 'low';
}
```

If the LLM can't fill `evidence`, the insight is dropped. This is the core anti-generic-advice guardrail.

**4. Streaming progress over polling.**
A full analysis takes 30-90 seconds. We use Server-Sent Events (native in Next.js 16 Route Handlers) to push step-by-step updates. UX feels instant; no "is it frozen?" moment.

**5. Stateless + ephemeral storage.**

- No database in MVP.
- Screenshots live in Vercel Blob with 24h TTL (Vercel Cron).
- Report JSON cached alongside; accessible via `/report/[id]` until expiry.
- Legal compliance with brief: no indefinite public scraping of third-party sites.

**6. API keys server-only.**
All AI and Firecrawl calls happen in Route Handlers / Server Actions. Nothing touches the client. `.env.example` documents required keys.

### Handling AI limitations

| Limit                 | Mitigation                                                                    |
| --------------------- | ----------------------------------------------------------------------------- |
| Context window        | Section-based analysis; summarize per-section before cross-site synthesis.    |
| Hallucination         | Structured output with Zod; evidence fields required; confidence scores.      |
| Rate limits           | Parallel-then-batch with retry on 429; Gemini Flash for cheap passes.         |
| Cost                  | Cache competitor lookups by domain (in-memory for MVP). Free-tier friendly.   |
| Long-running requests | SSE streaming + Vercel Functions max duration (300s is enough for 4 sites).   |
| Non-determinism       | `temperature: 0.2` for analysis calls; higher only for copy-suggestion tasks. |

### User controls (MVP + roadmap)

- **MVP:** user picks the URL. AI runs the rest. Report is read-only.
- **Next:** user can replace any of the 3 auto-picked competitors before analysis.
- **Later:** user can pin specific sections to analyze, or exclude categories.

### UI variant experiment

The deployed app ships **two working front-ends on top of the same API**, accessible via a "Classic | Chat" switcher in the header:

| Route          | Metaphor                                              | Hypothesis                                                                            |
| -------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/` — Classic  | Hero + form + tile grid                               | Trusted marketing-tool convention; stakeholder-friendly                               |
| `/v2` — Chat   | Conversational stream; each pipeline step is a message | AI-native users read this as transparent and "working"; lowers the "is it frozen?" feeling |

Both routes consume the same `/api/analyze` SSE endpoint and render the identical `ReportView` on completion — only presentation differs. Shipping both in parallel is a product experiment, not a fork: the goal is to validate which metaphor resonates with SaaS designers and PMs before collapsing on one. Post-MVP this would be A/B tested with completion rate and click-through to the report as the primary signals.

---

## 5. What Makes It Excellent

A mediocre version of this tool is a screenshot-based SEO audit with generic AI commentary. An excellent version differs on four axes:

### 1. Specificity over generality

- **Mediocre:** _"Improve your CTA."_
- **Excellent:** _"Your CTA 'Request a Demo' (gray, below fold at 1080px) reads as low-commitment compared to Lusha's 'Start Free — No Credit Card' (orange, right rail, always visible). Expected impact: medium-high."_

Every sentence in the output names a specific element, color, or phrase from the actual screenshot.

### 2. Evidence, not opinion

- Every claim has a pointer — a screenshot crop, a copy quote, a competitor name.
- Insights without evidence are silently dropped, not weakened. A short trustworthy report beats a long questionable one.
- Confidence scores are honest — if the AI saw a low-res crop, it says so.

### 3. Designer-grade language

- The output talks like a senior product designer, not a marketing blog. It references hierarchy, whitespace, contrast, cognitive load — using terms correctly.
- It understands _intent_: a B2B enterprise page should feel different from a dev-tool page. Recommendations respect the category.

### 4. Pragmatic prioritization

- Top 3 recommendations, not 30.
- Ordered by estimated conversion impact × implementation effort.
- "Don't change this" callouts — praise what works, so users don't rip out strengths.

### Non-goals (things a mediocre version adds, we deliberately don't)

- No SEO scoring.
- No performance/Lighthouse metrics.
- No generic best-practices checklist ("you need a phone number in the footer").
- No content farm output ("10 reasons your landing page matters").

We are a **senior design crit bot**, not an audit tool.

---

## 6. Success Metrics (post-MVP)

| Metric                      | Target | How measured                   |
| --------------------------- | ------ | ------------------------------ |
| Analysis completion rate    | >85%   | successful runs / started runs |
| Time to first insight       | <20s   | server log timestamps          |
| User rating per report      | ≥4/5   | inline thumbs survey           |
| Insights with evidence      | 100%   | schema validation              |
| Repeat usage within 30 days | >25%   | unique URL hash returns        |

---

## 7. What's Cut From MVP (and why)

| Cut                  | Reason                                                                                     | When to revisit          |
| -------------------- | ------------------------------------------------------------------------------------------ | ------------------------ |
| Auth / user accounts | Friction kills first-run experience; history isn't critical for single use.                | When repeat usage > 20%. |
| Competitor edit step | Trusting the AI's pick is a product statement; editing can come when we have UX bandwidth. | Week 2.                  |
| PDF export           | Screenshot-to-PDF is solved; shareable URL covers 80% of needs.                            | Based on user demand.    |
| Historical diffing   | Requires DB and scheduled runs. Out of scope for 8-hour MVP.                               | Phase 2.                 |
| Industry benchmarks  | Requires data aggregation across many runs.                                                | After 500+ analyses.     |
| Figma plugin         | Requires Figma API integration + manifest — own project.                                   | Post-product-market-fit. |

---

## 8. Open Questions & Risks

- **Competitor quality** — Gemini Grounding is good but not perfect. If it picks indirect competitors (e.g., picking Slack for Apollo), the whole report degrades. Mitigation: explicit prompt that demands "same buyer, same problem," plus displayed source URLs for user trust.
- **Scraping blockers** — some SaaS sites aggressively block bots (anti-Cloudflare, anti-Playwright). Mitigation: Firecrawl handles most; we surface graceful fallbacks ("couldn't capture competitor X, proceeding with 2").
- **Cost of vision at scale** — Gemini Pro vision calls are the expensive path. Mitigation: Flash-first for copy, Pro only for the visual analyst step.
- **Dynamic content / A/B tests** — two captures of the same URL can differ. Mitigation: accept it; log the capture timestamp; don't claim the report is "the" truth.
- **Non-SaaS pages** — the tool targets SaaS; e-commerce / consumer won't work well. Mitigation: clear scoping in UI copy; gentle error if detected.

---

## 9. Timeline (MVP execution)

| Phase           | Scope                                                     | Time    |
| --------------- | --------------------------------------------------------- | ------- |
| Scaffolding     | Next.js 16 project, Tailwind, shadcn, env setup           | 30min   |
| Agents          | Competitor finder + scraper + visual + copy + synthesizer | 3h      |
| API + streaming | Route handler with SSE progress events                    | 1h      |
| UI              | Landing with form, progress view, report page             | 2h      |
| Polish          | Error states, empty states, loading UX, README            | 1h      |
| Deploy          | Vercel, env vars, smoke test                              | 30min   |
| **Total**       |                                                           | **~8h** |

---

_End of PRD._
