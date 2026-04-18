'use client';

import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  AnalyzeEvent,
  Competitor,
  Report,
  SiteAnalysis,
} from '@/lib/schemas';
import { AnalyzeForm } from './analyze-form';
import { ProgressView, type SiteState } from './progress-view';
import { ReportView } from './report-view';

type Phase = 'idle' | 'running' | 'done' | 'error';

interface State {
  phase: Phase;
  userUrl: string;
  step: string;
  statusMessage: string;
  competitors: Competitor[];
  sites: SiteState[];
  report: Report | null;
  reportId: string | null;
  error: string;
}

const INITIAL_STATE: State = {
  phase: 'idle',
  userUrl: '',
  step: '',
  statusMessage: '',
  competitors: [],
  sites: [],
  report: null,
  reportId: null,
  error: '',
};

export function Analyzer() {
  const [state, setState] = useState<State>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = useCallback(async (rawUrl: string) => {
    const url = rawUrl.trim();
    setState({
      ...INITIAL_STATE,
      phase: 'running',
      userUrl: url,
      step: 'starting',
      statusMessage: 'Starting analysis…',
      sites: [{ url, name: 'Your site', role: 'user', status: 'pending' }],
    });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(errJson?.error || `Request failed: ${res.status}`);
      }
      if (!res.body) throw new Error('Empty response body');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE frames: events separated by blank line, each with `data: ...`
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          for (const line of frame.split('\n')) {
            if (!line.startsWith('data:')) continue;
            const json = line.slice(5).trim();
            if (!json) continue;
            try {
              const event = JSON.parse(json) as AnalyzeEvent;
              applyEvent(event, setState);
            } catch (err) {
              console.warn('Failed to parse SSE frame', err, json);
            }
          }
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) return;
      const message =
        err instanceof Error ? err.message : 'Unknown error during analysis';
      setState((s) => ({ ...s, phase: 'error', error: message }));
      toast.error(message);
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState(INITIAL_STATE);
  }, []);

  if (state.phase === 'done' && state.report) {
    return (
      <ReportView
        report={state.report}
        persistedReportId={state.reportId}
        onReset={reset}
      />
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="mx-auto max-w-xl rounded-lg border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">Analysis failed</p>
        <p className="mt-2 text-muted-foreground">{state.error}</p>
        <button
          onClick={reset}
          className="mt-4 text-sm font-medium underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    );
  }

  if (state.phase === 'running') {
    return (
      <ProgressView
        step={state.step}
        statusMessage={state.statusMessage}
        competitors={state.competitors}
        sites={state.sites}
        onCancel={reset}
      />
    );
  }

  return <AnalyzeForm onSubmit={handleSubmit} />;
}

function applyEvent(
  event: AnalyzeEvent,
  setState: (fn: (prev: State) => State) => void,
) {
  switch (event.type) {
    case 'status':
      setState((s) => ({
        ...s,
        step: event.step,
        statusMessage: event.message,
      }));
      return;

    case 'competitors':
      setState((s) => {
        const userSite = s.sites[0];
        const userEntry: SiteState = userSite ?? {
          url: s.userUrl,
          name: 'Your site',
          role: 'user',
          status: 'pending',
        };
        const competitorSites: SiteState[] = event.competitors.map((c) => ({
          url: c.url,
          name: c.name,
          role: 'competitor',
          status: 'pending',
        }));
        return {
          ...s,
          competitors: event.competitors,
          sites: [userEntry, ...competitorSites],
        };
      });
      return;

    case 'siteReady':
      setState((s) => ({
        ...s,
        sites: s.sites.map((site) =>
          site.url === event.url
            ? {
                ...site,
                name: event.name,
                screenshotUrl: event.screenshotUrl,
                status: 'captured',
              }
            : site,
        ),
      }));
      return;

    case 'siteAnalyzed':
      setState((s) => ({
        ...s,
        sites: s.sites.map((site) =>
          site.url === event.analysis.url
            ? { ...site, analysis: event.analysis, status: 'analyzed' }
            : site,
        ),
      }));
      return;

    case 'complete':
      setState((s) => ({
        ...s,
        phase: 'done',
        report: event.report,
        reportId: event.reportId,
      }));
      return;

    case 'error':
      setState((s) => ({ ...s, phase: 'error', error: event.message }));
      return;
  }
}

// Make SiteAnalysis type usable from this module (avoids unused import warning).
export type { SiteAnalysis };
