# Landing Crit — Competitive SaaS Landing Page Analyzer

Paste any SaaS landing-page URL. The tool finds your direct competitors, captures full-page screenshots, and returns an evidence-backed, prioritized design critique in ~60-90 seconds.

Built as a take-home for **Cieden**. Full product thinking lives in [`PRD.md`](./PRD.md).

---

## What it does

1. **Finds competitors** — Gemini 2.5 Flash with Google-Search grounding identifies 3 direct competitors and cites the research sources.
2. **Captures screenshots** — Firecrawl pulls full-page screenshots and markdown for the user's site plus each competitor in parallel.
3. **Analyzes design + copy** — a Visual Analyst (Gemini 2.5 Pro, vision) and a Copy Analyst (Gemini 2.5 Flash) run on each site with structured-output schemas.
4. **Synthesizes insights** — a senior-designer-prompted synthesizer produces evidence-backed insights with priority + confidence scores.
5. **Streams progress** — Server-Sent Events keep the UI responsive: the user sees each step as it happens.
6. **Persists optionally** — if Vercel Blob is configured, reports get a shareable `/report/[id]` URL and screenshots auto-expire after 24h.

## Tech stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| UI | Tailwind v4 + shadcn/ui |
| AI | Vercel AI SDK v6 + `@ai-sdk/google` (Gemini 2.5 Flash by default; Pro via env override when billing is enabled) |
| Search grounding | Built-in `google_search` tool on Gemini |
| Scraping | Firecrawl v2 SDK |
| Storage (optional) | Vercel Blob |
| Hosting | Vercel |

## Running locally

### 1. Install

```bash
npm install
```

### 2. Configure env

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

- **`GOOGLE_GENERATIVE_AI_API_KEY`** — required. Free at <https://aistudio.google.com/apikey>.
- **`FIRECRAWL_API_KEY`** — required. Free tier at <https://firecrawl.dev>.
- **`BLOB_READ_WRITE_TOKEN`** — *optional*. Without it the app still works; shareable `/report/[id]` URLs are disabled. Get one by creating a Blob store at <https://vercel.com/dashboard/stores>.

### 3. Run dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

## Two UI variants

The app ships two working front-ends on top of the same API:

| Route | Metaphor | Best for |
|---|---|---|
| `/` — **Classic** | Hero + form + progress tiles grid | Marketing-style landing; stakeholder demos |
| `/v2` — **Chat** | Conversational; each analysis step streams in as a chat message | Feels native for AI-tool users; shows the pipeline as a transparent back-and-forth |

A segmented control in the top-right of each page flips between them. Both share `/api/analyze`, `lib/schemas.ts`, and the final `ReportView` — only the presentation layer differs. This is intentional: it's a product experiment about which metaphor resonates, not two forks of the codebase.

## Project layout

```
app/
  page.tsx                 — v1: marketing hero + Analyzer
  v2/page.tsx              — v2: chat-first variant
  api/analyze/route.ts     — SSE-over-POST endpoint (shared by both variants)
  report/[id]/page.tsx     — shareable persisted report view
components/
  analyzer.tsx             — v1 state machine
  analyze-form.tsx         — v1 URL input
  progress-view.tsx        — v1 per-site progress tiles + step indicator
  report-view.tsx          — final report UI (shared)
  version-switcher.tsx     — segmented control linking / ↔ /v2
  v2/
    conversational-analyzer.tsx — v2 chat UI + SSE→message mapping
  ui/                      — shadcn primitives
lib/
  schemas.ts               — Zod schemas (single source of truth)
  orchestrator.ts          — wires agents + emits events
  services/
    gemini.ts              — AI SDK model factories
    firecrawl.ts           — capture wrapper
    blob.ts                — optional persistence
  agents/
    competitor-finder.ts   — grounded search → structured list
    scraper.ts             — parallel capture with tolerance
    visual-analyst.ts      — vision critique (Pro)
    copy-analyst.ts        — copy critique (Flash)
    synthesizer.ts         — evidence-backed insights
PRD.md                     — full product vision
```

## Design decisions worth calling out

**Two UI metaphors, one engine.** The `/` and `/v2` routes are shipped side-by-side as a deliberate product experiment. Same `/api/analyze`, same Zod schemas, same `ReportView` — only the presentation changes. The "classic" variant treats the tool like a form (paste URL → get report); the "chat" variant treats the analysis as a conversation with a crit analyst. Reviewers can flip between them via the version switcher in the top-right.

**Multi-agent, not one megaprompt.** Each step is a narrow call with a Zod-validated structured output. Cleaner prompts, lower hallucination, parallelizable, individually retryable.

**Evidence-first contract.** Every insight carries `{claim, evidence, confidence, priority}`. Insights that can't be grounded in a specific observation are dropped at the schema layer. This is the core anti-generic-advice guardrail.

**Section-tolerant visual analysis.** Full-page screenshots are fed directly to Gemini Pro's multimodal endpoint — it handles long pages well. If this starts to fail on very tall pages, the next iteration crops into hero / features / social proof / pricing / footer sections (see the "Could-have" section of the PRD).

**Stateless, ephemeral by default.** No database. Reports live for 24h in Vercel Blob, cleaned up via Vercel Cron. This is both an MVP simplicity win and a legal requirement (the brief forbids leaving scraped pages in the public domain indefinitely).

**Server-only API keys.** Every AI / Firecrawl / Blob call runs in a Next.js Route Handler or Server Action. Nothing touches the browser.

## What's intentionally not here (MVP cut list)

Detailed in the PRD; at a glance:

- Authentication / accounts
- Competitor edit step before analysis
- PDF export
- Historical diffs or re-runs
- Industry benchmarks
- Figma plugin

## Deploying to Vercel

```bash
# from the project root
npx vercel
```

Add the three env vars in the Vercel dashboard (or via `vercel env add`). No additional infra setup is required — Blob provisions automatically if you enable the integration.

## License

Built for the Cieden take-home; free to reuse for reference.
