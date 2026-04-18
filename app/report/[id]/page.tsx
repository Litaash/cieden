import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReportView } from '@/components/report-view';
import { fetchReport, isBlobConfigured } from '@/lib/services/blob';

interface Params {
  id: string;
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ReportPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;

  if (!isBlobConfigured()) {
    return (
      <main className="mx-auto w-full max-w-xl px-6 py-24 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          Shareable reports are disabled
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This instance is running without a Vercel Blob token, so reports
          aren&rsquo;t persisted. Run an analysis from the home page and view
          the result inline.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to home
        </Link>
      </main>
    );
  }

  const report = await fetchReport(id);
  if (!report) notFound();

  return (
    <main className="flex flex-1 flex-col">
      <div className="border-b bg-background/60 backdrop-blur">
        <div className="mx-auto w-full max-w-5xl px-6 py-3 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            ← Landing Crit
          </Link>
          <Link
            href="/"
            className="inline-flex h-7 items-center rounded-lg border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
          >
            New analysis
          </Link>
        </div>
      </div>
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <ReportView report={report} persistedReportId={id} />
      </div>
    </main>
  );
}
