import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * Tiny segmented control that lets reviewers flip between the two UI
 * variants we ship for the Cieden take-home: the form-based "Classic"
 * version at `/` and the conversational "Chat" version at `/v2`.
 */

interface Props {
  current: 'classic' | 'chat';
}

export function VersionSwitcher({ current }: Props) {
  return (
    <nav
      aria-label="UI variant"
      className="inline-flex items-center rounded-full border bg-background/70 p-0.5 text-[11px] font-medium shadow-sm backdrop-blur"
    >
      <Link
        href="/"
        aria-current={current === 'classic' ? 'page' : undefined}
        className={cn(
          'rounded-full px-3 py-1 transition-colors',
          current === 'classic'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Classic
      </Link>
      <Link
        href="/v2"
        aria-current={current === 'chat' ? 'page' : undefined}
        className={cn(
          'rounded-full px-3 py-1 transition-colors',
          current === 'chat'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Chat
      </Link>
    </nav>
  );
}
