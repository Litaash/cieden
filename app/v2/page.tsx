import Link from 'next/link';
import { ConversationalAnalyzer } from '@/components/v2/conversational-analyzer';
import { VersionSwitcher } from '@/components/version-switcher';

export const metadata = {
  title: 'Landing Crit · Chat mode',
  description:
    'Conversational version of the Landing Crit competitive analyzer.',
  robots: { index: false, follow: false },
};

export default function V2Page() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-linear-to-b from-primary/6 via-primary/2 to-transparent" />
        <div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-6">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              ← Landing Crit
            </Link>
            <VersionSwitcher current="chat" />
          </div>

          <div className="mx-auto mt-8 max-w-2xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Chat mode · experimental
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
              Talk to a landing-page crit analyst.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Same engine, different metaphor. Watch the analysis unfold as a
              streaming conversation — each step is a message you can follow.
            </p>
          </div>

          <div className="mt-8">
            <ConversationalAnalyzer />
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground">
          <span>
            Alternate UI · built for the Cieden take-home · Screenshots expire
            in 24 hours
          </span>
          <span className="font-mono">chat · gemini 2.5 · firecrawl</span>
        </div>
      </footer>
    </main>
  );
}
