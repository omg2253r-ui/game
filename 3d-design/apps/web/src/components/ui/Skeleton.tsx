import { cx } from './cx';

/** Static placeholder block. No shimmer: motion here would be decorative. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cx('rounded-control bg-surface-2', className)} />;
}
