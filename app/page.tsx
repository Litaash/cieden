import { Analyzer } from '@/components/analyzer';

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[520px] bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent" />
        <div className="mx-auto w-full max-w-5xl px-6 pt-16 pb-10 sm:pt-24 sm:pb-14">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 backdrop-blur px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Landing Crit · MVP
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              A senior designer&rsquo;s critique
              <br className="hidden sm:block" /> of your SaaS landing page.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Paste your URL. We find your direct competitors, capture
              screenshots, and return an evidence-backed, prioritized design
              crit in under 90 seconds.
            </p>
          </div>

          <div className="mt-10">
            <Analyzer />
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/20">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-6 py-14 sm:grid-cols-3">
          <Feature
            title="Evidence, not vibes"
            body="Every insight quotes specific copy or references a named screenshot element. No generic ‘improve your CTA’ advice."
          />
          <Feature
            title="Real competitors"
            body="Competitors are picked via live Google Search grounding with cited sources — not pulled from a stale database."
          />
          <Feature
            title="Designer-grade output"
            body="Hierarchy, contrast, whitespace, cognitive load — the tool thinks in design terms, not SEO checkboxes."
          />
        </div>
      </section>

      <footer className="mt-auto border-t">
        <div className="mx-auto w-full max-w-5xl px-6 py-6 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
          <span>
            Built for the Cieden take-home · Screenshots expire in 24 hours
          </span>
          <span className="font-mono">
            next.js 16 · gemini 2.5 · firecrawl
          </span>
        </div>
      </footer>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div className="text-sm font-medium">{title}</div>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
        {body}
      </p>
    </div>
  );
}
