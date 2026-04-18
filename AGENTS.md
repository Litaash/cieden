<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Landing Crit — Agent Context

> Take-home project for **Cieden**. Full product thinking lives in [`PRD.md`](./PRD.md).

## What this is

A multi-agent SaaS landing-page analyzer. User pastes a URL → system finds 3 direct competitors via Google Search grounding → captures full-page screenshots with Firecrawl → runs visual + copy analysis per site → synthesizes evidence-backed, prioritized design insights. Streams progress via SSE.

## Stack (pinned versions)

| Layer | Version |
|---|---|
| Next.js | **16.2.4** (App Router, Turbopack) |
| React | **19.2.4** |
| TypeScript | **5.x** |
| Vercel AI SDK | **6.x** (`ai` package) |
| `@ai-sdk/google` | current |
| Tailwind CSS | **v4** (not v3 — config and class names differ) |
| shadcn/ui | latest (components in `components/ui/`) |
| Firecrawl | `@mendable/firecrawl-js` v2 |
| Vercel Blob | `@vercel/blob` |

⚠️ **Tailwind v4**: no `tailwind.config.ts`, no `@apply` in new code, no `[arbitrary]` variants unless absolutely necessary. Use utility classes directly.

⚠️ **AI SDK v6**: `generateObject`, `generateText`, `streamText` are imported from `"ai"`. Provider models come from `@ai-sdk/google` via `google()` factory. `maxRetries` is a first-class param on every call. Do not use the old `@vercel/ai` or v5 import paths.

## Project layout

```
app/
  page.tsx                 — marketing hero + Analyzer
  layout.tsx               — root layout (Geist font, Toaster, noindex metadata)
  robots.ts                — blocks all crawlers (take-home, not for indexing)
  api/analyze/route.ts     — SSE-over-POST; maxDuration 300s; nodejs runtime
  report/[id]/page.tsx     — shareable persisted report (Blob-backed, 24h TTL)
components/
  analyzer.tsx             — top-level client state machine; owns SSE parsing
  analyze-form.tsx         — URL input form
  progress-view.tsx        — per-site tiles (pending/captured/analyzed/failed) + step badges
  report-view.tsx          — final report UI (insights, evidence, screenshots, failed-captures note)
  ui/                      — shadcn primitives (badge, button, card, progress, separator, skeleton, sonner)
lib/
  schemas.ts               — Zod schemas: SINGLE SOURCE OF TRUTH for all data shapes
  orchestrator.ts          — wires agents, emits SSE events, runs a streaming capture→analyze pipeline with a semaphore
  services/
    gemini.ts              — model factories: geminiFlash, geminiPro (env-overridable)
    firecrawl.ts           — captureLanding() wrapper; normalizes screenshot to Uint8Array
    blob.ts                — optional Blob persistence; fetchReport validates via ReportSchema
  agents/
    competitor-finder.ts   — 2-step: grounded search → structured extraction
    scraper.ts             — legacy parallel captureAll() helper (not on the hot path; kept for tests / fallback)
    visual-analyst.ts      — Gemini Pro vision → VisualAnalysisSchema
    copy-analyst.ts        — Gemini Flash text → CopyAnalysisSchema
    synthesizer.ts         — Gemini Pro text → SynthesisSchema (evidence required)
```

## Key architectural rules

### 1. Zod schemas are the contract
`lib/schemas.ts` is the single source of truth. AI structured outputs, SSE event shapes, and the persisted Report all derive from Zod schemas. **Never cast `as SomeType` to work around a schema mismatch — fix the schema or the prompt.**

### 2. Evidence-first: no schema, no insight
Every `Insight` in `SynthesisSchema` requires an `evidence.yourSite.observation`. If the model can't ground a claim, the schema rejects it. Do not relax this constraint.

### 3. Concurrency assumes paid Gemini quota
`ANALYSIS_CONCURRENCY = 4` in `orchestrator.ts`. Each site fires 2 analyst calls, so peak in-flight analyst traffic is ~8 requests. This is fine on Gemini Tier 1 (paid), but reliably trips 429 on free tier (20 RPM on Flash). If running without billing, drop this to 2 and expect longer wall times. The orchestrator also starts the **user's capture in parallel with `findCompetitors`** and streams each site into analysis the moment its capture lands — capture and analyze phases overlap, so the 'capture' SSE status is only briefly the sole step.

### 4. Model defaults are free-tier-safe
`lib/services/gemini.ts` defaults **both** `geminiFlash` and `geminiPro` to `gemini-2.5-flash`. Google zeroed the free-tier quota for `gemini-2.5-pro`. Upgrade via `GEMINI_PRO_MODEL=gemini-2.5-pro` in `.env.local` when billing is active.

### 5. All AI / Firecrawl / Blob calls are server-only
Everything runs in Route Handlers or Server Actions. Nothing touches the browser. Keep it that way.

### 6. Blob is optional
When `BLOB_READ_WRITE_TOKEN` is absent, screenshots are inlined as data URLs and reports are not persisted. The app must work fully without Blob.

### 7. Failed captures are first-class
`FailedCapture` schema + `siteFailed` SSE event. The orchestrator classifies failures into `'blocked' | 'timeout' | 'not_found' | 'other'`. UI reflects this in both the progress tiles and the final report. Do not silently drop failed captures.

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | AI Studio key. Must be Tier 1 (paid) for production use; free tier hits quota fast. |
| `FIRECRAWL_API_KEY` | yes | Firecrawl v2. Free tier: 500 scrapes/month. |
| `BLOB_READ_WRITE_TOKEN` | no | Enables shareable `/report/[id]` URLs and 24h-TTL screenshot storage. |
| `GEMINI_FLASH_MODEL` | no | Default: `gemini-2.5-flash` |
| `GEMINI_PRO_MODEL` | no | Default: `gemini-2.5-flash` (set to `gemini-2.5-pro` with paid billing) |

## Common failure modes and fixes

| Symptom | Cause | Fix |
|---|---|---|
| `quota exceeded … limit: 20, model: gemini-2.5-flash` | Hitting Gemini free-tier RPM (20 req/min) | Wait ~60s; or enable billing and upgrade `GEMINI_PRO_MODEL`. |
| `quota exceeded … limit: 0, model: gemini-2.5-pro` | Pro has zero free-tier quota | Set `GEMINI_PRO_MODEL=gemini-2.5-flash` or enable billing. |
| `All scraping engines failed … ZoomInfo / Cloudflare` | Site blocks Firecrawl's CDPs | Expected; orchestrator emits `siteFailed` with `reasonCategory: 'blocked'`. |
| `scrape operation timed out` | Heavy JS / Cloudflare challenge takes >180s | `timeout` in `firecrawl.ts` is already 180s; not much more we can do on free tier. |
| `Could not capture the primary site` | User URL failed to scrape (thrown, not tolerated) | Check that the URL is publicly accessible without login. |

## What's intentionally NOT here (MVP cut list)

- Authentication / accounts
- Competitor edit step before analysis starts
- PDF export
- Historical diffs / scheduled re-runs
- Industry benchmarks
- Figma plugin

See `PRD.md` §7 for rationale and revisit triggers.
