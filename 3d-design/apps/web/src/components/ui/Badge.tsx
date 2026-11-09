import type { ReactNode } from 'react';
import { cx } from './cx';

export type BadgeTone = 'neutral' | 'ok' | 'warn' | 'danger';

const TONE: Record<BadgeTone, string> = {
  neutral: 'border-line text-muted',
  ok: 'border-ok/50 text-ok',
  warn: 'border-accent-ink/60 text-accent-ink',
  danger: 'border-danger/60 text-danger',
};

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-0.5 rounded-pill border px-1 text-caption whitespace-nowrap',
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
