import type { HTMLAttributes } from 'react';
import { cx } from './cx';

/**
 * Two kinds of card only, on purpose (see DESIGN.md §4):
 * - tile:   a labelled item on a shelf (library). Border changes on hover/focus; no shadow, no motion.
 * - notice: an inline note in a tool tray (onboarding). Tape-yellow edge marks "read this next".
 * Panels are not cards: they are flush trays separated by 1px lines.
 */
export type CardVariant = 'tile' | 'notice';

const VARIANT: Record<CardVariant, string> = {
  tile: 'flex flex-col rounded-tile border border-line bg-surface hover:border-line-strong focus-within:border-line-strong',
  notice: 'flex flex-col gap-1 border-l-2 border-accent-ink bg-surface-2 py-1 pl-1.5 pr-1',
};

export function Card({
  variant,
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { variant: CardVariant }) {
  // Tiles are articles (one per item, no landmark noise); notices are sections.
  const Tag = variant === 'tile' ? 'article' : 'section';
  return <Tag className={cx(VARIANT[variant], className)} {...rest} />;
}
