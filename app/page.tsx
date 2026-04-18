import { Analyzer } from "@/components/analyzer";
import { BuiltWith } from "@/components/landing/built-with";
import { FeatureCards } from "@/components/landing/feature-cards";
import { HowItWorks } from "@/components/landing/how-it-works";
import { VersionSwitcher } from "@/components/version-switcher";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-linear-to-b from-primary/6 via-primary/2 to-transparent" />
        <div className="pointer-events-none absolute -z-10 top-[340px] left-1/2 h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

        <div className="mx-auto w-full max-w-5xl px-6 pt-10 pb-16 sm:pt-14 sm:pb-24">
          <div className="flex items-center justify-end">
            <VersionSwitcher current="classic" />
          </div>

          <div className="mx-auto mt-10 max-w-3xl text-center sm:mt-14">
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Landing Crit · MVP
            </div>
            <h1 className="mt-6 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Your landing page,
              <br className="hidden sm:block" /> critiqued by AI.
            </h1>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg">
              Paste your URL. We research your competitors, capture
              screenshots, and return an evidence-backed, prioritized design
              crit.
            </p>
          </div>

          <div className="mt-10">
            <Analyzer />
          </div>

        </div>
      </section>

      <section className="border-t bg-muted/20">
        <div className="mx-auto w-full max-w-5xl px-6 py-14 sm:py-20">
          <FeatureCards />
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto w-full max-w-5xl px-6 py-14 sm:py-20">
          <HowItWorks />
        </div>
      </section>

      <section className="border-t bg-muted/20">
        <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:py-14">
          <BuiltWith />
        </div>
      </section>

      <footer className="mt-auto border-t">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-center px-6 py-6 text-xs text-muted-foreground">
          <span>Built for the Cieden take-home · Screenshots expire in 24 hours</span>
        </div>
      </footer>
    </main>
  );
}
