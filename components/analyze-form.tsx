'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Props {
  onSubmit: (url: string) => void;
}

const EXAMPLES = [
  'https://apollo.io',
  'https://linear.app',
  'https://resend.com',
  'https://vercel.com',
];

export function AnalyzeForm({ onSubmit }: Props) {
  const [url, setUrl] = useState('');
  const [touched, setTouched] = useState(false);

  const isValid = (() => {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  })();

  const showError = touched && !!url && !isValid;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          if (isValid) onSubmit(url);
        }}
        className="flex flex-col gap-3 sm:flex-row"
      >
        <div className="flex-1">
          <Input
            type="url"
            inputMode="url"
            autoFocus
            required
            placeholder="https://your-saas.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onBlur={() => setTouched(true)}
            className={cn(
              'h-12 text-base',
              showError && 'border-destructive focus-visible:ring-destructive',
            )}
          />
          {showError && (
            <p className="mt-1.5 text-xs text-destructive">
              Please enter a valid URL like https://apollo.io
            </p>
          )}
        </div>
        <Button type="submit" size="lg" className="h-12 px-6 text-base">
          Analyze
        </Button>
      </form>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => {
              setUrl(ex);
              setTouched(false);
            }}
            className="rounded-full border bg-background px-3 py-1 hover:bg-muted transition-colors"
          >
            {ex.replace('https://', '')}
          </button>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Analysis takes 30–90 seconds. Screenshots auto-expire after 24 hours.
      </p>
    </div>
  );
}
