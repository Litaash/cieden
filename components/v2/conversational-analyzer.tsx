'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import type {
  AnalyzeEvent,
  Competitor,
  FailedCapture,
  Report,
  SiteAnalysis,
} from '@/lib/schemas';
import { ReportView } from '@/components/report-view';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Phase = 'idle' | 'running' | 'done' | 'error';

/**
 * Conversational v2 of the analyzer.
 *
 * Same underlying SSE API, different product metaphor: the analysis is
 * presented as an ongoing chat with a "Crit Analyst". Each SSE event
 * becomes either a new assistant message or an update to the last one.
 */

type MessageKind =
  | { kind: 'text'; content: string }
  | { kind: 'status'; label: string; detail: string; done: boolean }
  | { kind: 'competitors'; competitors: Competitor[] }
  | {
      kind: 'site';
      url: string;
      name: string;
      role: 'user' | 'competitor';
      status: 'capturing' | 'captured' | 'analyzed' | 'failed';
      screenshotUrl?: string;
      failureLabel?: string;
      failureReason?: string;
    };

interface ChatMessage {
  id: string;
  author: 'user' | 'assistant';
  body: MessageKind;
}

const GREETING: ChatMessage = {
  id: 'greeting',
  author: 'assistant',
  body: {
    kind: 'text',
    content:
      "Hi — I'm your landing-page crit analyst. Paste a SaaS URL and I'll find three direct competitors, capture them, and send back a prioritized, evidence-backed critique.",
  },
};

const EXAMPLES = ['apollo.io', 'linear.app', 'resend.com', 'vercel.com'];

export function ConversationalAnalyzer() {
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING]);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [report, setReport] = useState<Report | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isValid = useMemo(() => {
    try {
      const u = new URL(normalize(input));
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, [input]);

  const pushMessage = useCallback((msg: ChatMessage) => {
    setMessages((m) => [...m, msg]);
  }, []);

  const patchLastStatus = useCallback((markDone: boolean) => {
    setMessages((m) => {
      const next = [...m];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].body.kind === 'status') {
          next[i] = {
            ...next[i],
            body: { ...(next[i].body as Extract<MessageKind, { kind: 'status' }>), done: markDone },
          };
          break;
        }
      }
      return next;
    });
  }, []);

  const updateSiteMessage = useCallback(
    (
      url: string,
      patch: Partial<Extract<MessageKind, { kind: 'site' }>>,
    ) => {
      setMessages((m) =>
        m.map((msg) =>
          msg.body.kind === 'site' && msg.body.url === url
            ? { ...msg, body: { ...msg.body, ...patch } }
            : msg,
        ),
      );
    },
    [],
  );

  const ensureSiteMessage = useCallback(
    (
      url: string,
      defaults: Partial<Extract<MessageKind, { kind: 'site' }>>,
    ) => {
      setMessages((m) => {
        const exists = m.some(
          (msg) => msg.body.kind === 'site' && msg.body.url === url,
        );
        if (exists) return m;
        return [
          ...m,
          {
            id: `site-${url}`,
            author: 'assistant',
            body: {
              kind: 'site',
              url,
              name: defaults.name ?? urlToName(url),
              role: defaults.role ?? 'competitor',
              status: defaults.status ?? 'capturing',
              screenshotUrl: defaults.screenshotUrl,
              failureLabel: defaults.failureLabel,
              failureReason: defaults.failureReason,
            },
          },
        ];
      });
    },
    [],
  );

  const runAnalysis = useCallback(
    async (rawUrl: string) => {
      const url = normalize(rawUrl);
      setPhase('running');
      setError('');
      setReport(null);
      setReportId(null);

      pushMessage({
        id: `user-${Date.now()}`,
        author: 'user',
        body: { kind: 'text', content: url },
      });
      pushMessage({
        id: `ack-${Date.now()}`,
        author: 'assistant',
        body: {
          kind: 'text',
          content:
            "Got it. Starting now — I'll stream updates as each step lands. Expected: 30–90 seconds.",
        },
      });

      ensureSiteMessage(url, {
        name: 'Your site',
        role: 'user',
        status: 'capturing',
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
                applyEvent(event);
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
        setPhase('error');
        setError(message);
        toast.error(message);
        pushMessage({
          id: `err-${Date.now()}`,
          author: 'assistant',
          body: {
            kind: 'text',
            content: `Something went wrong: ${message}`,
          },
        });
      }

      function applyEvent(event: AnalyzeEvent) {
        switch (event.type) {
          case 'status':
            patchLastStatus(true);
            pushMessage({
              id: `status-${event.step}-${Date.now()}`,
              author: 'assistant',
              body: {
                kind: 'status',
                label: stepLabel(event.step),
                detail: event.message,
                done: false,
              },
            });
            return;

          case 'competitors':
            patchLastStatus(true);
            pushMessage({
              id: `competitors-${Date.now()}`,
              author: 'assistant',
              body: {
                kind: 'competitors',
                competitors: event.competitors,
              },
            });
            for (const c of event.competitors) {
              ensureSiteMessage(c.url, {
                name: c.name,
                role: 'competitor',
                status: 'capturing',
              });
            }
            return;

          case 'siteReady':
            updateSiteMessage(event.url, {
              name: event.name,
              status: 'captured',
              screenshotUrl: event.screenshotUrl,
            });
            return;

          case 'siteFailed':
            updateSiteMessage(event.url, {
              name: event.name,
              status: 'failed',
              failureLabel: event.failure.reasonLabel,
              failureReason: event.failure.reason,
            });
            return;

          case 'siteAnalyzed':
            updateSiteMessage(event.analysis.url, {
              name: event.analysis.name,
              status: 'analyzed',
              screenshotUrl: event.analysis.screenshotUrl,
            });
            return;

          case 'complete':
            patchLastStatus(true);
            setReport(event.report);
            setReportId(event.reportId);
            setPhase('done');
            pushMessage({
              id: `done-${Date.now()}`,
              author: 'assistant',
              body: {
                kind: 'text',
                content: `Done. Here's your crit${failureSummary(event.report.failedCaptures)}.`,
              },
            });
            return;

          case 'error':
            setPhase('error');
            setError(event.message);
            pushMessage({
              id: `err-${Date.now()}`,
              author: 'assistant',
              body: { kind: 'text', content: `Error: ${event.message}` },
            });
            return;
        }
      }
    },
    [ensureSiteMessage, patchLastStatus, pushMessage, updateSiteMessage],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([GREETING]);
    setInput('');
    setPhase('idle');
    setReport(null);
    setReportId(null);
    setError('');
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (phase === 'done' && report) {
    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-10">
        <div className="mb-6 flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Chat · Report
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            New analysis
          </Button>
        </div>
        <ReportView
          report={report}
          persistedReportId={reportId}
          onReset={reset}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-8rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-card/40 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between border-b bg-background/60 px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                'absolute inline-flex h-full w-full rounded-full bg-primary opacity-50',
                phase === 'running' && 'animate-ping',
              )}
            />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <span className="text-sm font-medium">Crit Analyst</span>
          <span className="text-xs text-muted-foreground">
            · {phase === 'running' ? 'typing…' : 'ready'}
          </span>
        </div>
        {phase === 'running' && (
          <button
            onClick={() => {
              abortRef.current?.abort();
              setPhase('idle');
              pushMessage({
                id: `cancel-${Date.now()}`,
                author: 'assistant',
                body: { kind: 'text', content: 'Analysis cancelled.' },
              });
            }}
            className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-6"
      >
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
        {phase === 'error' && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error || 'Something went wrong.'}
            <button
              onClick={reset}
              className="ml-2 underline underline-offset-4"
            >
              Start over
            </button>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (phase === 'running' || !isValid) return;
          const url = input;
          setInput('');
          void runAnalysis(url);
        }}
        className="border-t bg-background/80 px-5 py-4"
      >
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="chat-url" className="sr-only">
              Landing page URL
            </label>
            <input
              id="chat-url"
              type="url"
              inputMode="url"
              autoFocus
              disabled={phase === 'running'}
              placeholder={
                phase === 'running'
                  ? 'Analysis in progress…'
                  : 'Paste your SaaS landing page URL…'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2.5 text-sm outline-none ring-offset-background transition-colors focus:ring-2 focus:ring-ring disabled:opacity-60"
            />
          </div>
          <Button
            type="submit"
            disabled={phase === 'running' || !isValid}
            className="shrink-0"
          >
            Send
          </Button>
        </div>
        {phase === 'idle' && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setInput(`https://${ex}`)}
                className="rounded-full border bg-background/60 px-2.5 py-0.5 transition-colors hover:bg-muted"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
        {phase === 'idle' && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Analysis takes 30–90 seconds. Screenshots auto-expire after 24
            hours.
          </p>
        )}
      </form>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  const isUser = message.author === 'user';
  return (
    <div
      className={cn(
        'flex w-full gap-3',
        isUser ? 'justify-end' : 'justify-start',
      )}
    >
      {!isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
          CA
        </div>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted/60 text-foreground',
          message.body.kind !== 'text' && !isUser && 'bg-transparent p-0',
        )}
      >
        {renderBody(message.body, isUser)}
      </div>
      {isUser && (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-[11px] font-semibold">
          You
        </div>
      )}
    </div>
  );
}

function renderBody(body: MessageKind, isUser: boolean) {
  switch (body.kind) {
    case 'text':
      return <span className="whitespace-pre-wrap wrap-break-word">{body.content}</span>;

    case 'status':
      return (
        <StatusRow label={body.label} detail={body.detail} done={body.done} />
      );

    case 'competitors':
      return <CompetitorCards competitors={body.competitors} />;

    case 'site':
      return (
        <SiteCard
          name={body.name}
          url={body.url}
          role={body.role}
          status={body.status}
          screenshotUrl={body.screenshotUrl}
          failureLabel={body.failureLabel}
          failureReason={body.failureReason}
        />
      );

    default: {
      const exhaustive: never = body;
      void exhaustive;
      void isUser;
      return null;
    }
  }
}

function StatusRow({
  label,
  detail,
  done,
}: {
  label: string;
  detail: string;
  done: boolean;
}) {
  return (
    <div className="rounded-lg border bg-background/60 px-3 py-2 text-xs">
      <div className="flex items-center gap-2 font-medium">
        {done ? (
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5 text-emerald-500"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <span className="h-3.5 w-3.5 shrink-0">
            <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </span>
        )}
        <span>{label}</span>
      </div>
      {detail && (
        <div className="mt-0.5 pl-5 text-muted-foreground">{detail}</div>
      )}
    </div>
  );
}

function CompetitorCards({ competitors }: { competitors: Competitor[] }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Direct competitors identified
      </div>
      <ul className="mt-2 space-y-2">
        {competitors.map((c) => (
          <li
            key={c.url}
            className="rounded-md border bg-background/70 px-3 py-2 text-xs"
          >
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{c.name}</span>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                {c.url.replace(/^https?:\/\//, '')}
              </a>
            </div>
            <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
              {c.reasoning}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiteCard({
  name,
  url,
  role,
  status,
  screenshotUrl,
  failureLabel,
  failureReason,
}: {
  name: string;
  url: string;
  role: 'user' | 'competitor';
  status: 'capturing' | 'captured' | 'analyzed' | 'failed';
  screenshotUrl?: string;
  failureLabel?: string;
  failureReason?: string;
}) {
  const statusDot =
    status === 'analyzed'
      ? 'bg-emerald-500'
      : status === 'captured'
        ? 'bg-amber-500'
        : status === 'failed'
          ? 'bg-destructive/70'
          : 'bg-muted-foreground/30';

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border bg-background/70 text-xs',
        role === 'user' && 'border-primary/40',
        status === 'failed' && 'border-destructive/30 bg-destructive/5',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <span className={cn('h-1.5 w-1.5 rounded-full', statusDot)} />
        <span className="text-sm font-medium">{name}</span>
        <span className="text-[11px] text-muted-foreground">
          {url.replace(/^https?:\/\//, '')}
        </span>
        <span
          className={cn(
            'ml-auto text-[10px] uppercase tracking-wider text-muted-foreground',
            status === 'failed' && 'text-destructive/80',
          )}
          title={status === 'failed' ? failureReason : undefined}
        >
          {status === 'failed' ? (failureLabel ?? 'Failed') : status}
        </span>
      </div>
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {status === 'failed' ? (
          <div className="absolute inset-0 flex items-center justify-center p-3 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,0.03)_6px,rgba(0,0,0,0.03)_12px)]">
            <span className="text-[11px] font-medium text-destructive/80">
              {failureLabel || 'Capture failed'}
            </span>
          </div>
        ) : screenshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={screenshotUrl}
            alt={`${name} landing page`}
            className={cn(
              'absolute inset-0 h-full w-full object-cover object-top transition-all',
              status !== 'analyzed' && 'opacity-60 grayscale',
            )}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}

function stepLabel(step: string): string {
  switch (step) {
    case 'starting':
      return 'Starting';
    case 'competitors':
      return 'Finding competitors';
    case 'capture':
      return 'Capturing screenshots';
    case 'analyze':
      return 'Analyzing design & copy';
    case 'synthesize':
      return 'Synthesizing insights';
    case 'persist':
      return 'Saving report';
    default:
      return step;
  }
}

function urlToName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return host;
  } catch {
    return url;
  }
}

function normalize(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function failureSummary(failed: FailedCapture[]): string {
  if (!failed.length) return '';
  const names = failed.map((f) => f.name).join(', ');
  return ` — couldn't capture ${names}, so the report is based on the remaining sites`;
}

// Keep helper types reachable so future widgets can extend the conversation.
export type { SiteAnalysis, ChatMessage };
