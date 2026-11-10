import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
  /** Secondary line, e.g. cost or detail. */
  hint?: ReactNode;
}

interface SegmentedProps<V extends string> {
  label: string;
  value: V;
  options: SegmentedOption<V>[];
  onChange: (v: V) => void;
  layout?: 'row' | 'stack';
  hideLabel?: boolean;
}

/** Radio group with roving focus (arrow keys move and select, per WAI-ARIA). */
export function Segmented<V extends string>({
  label,
  value,
  options,
  onChange,
  layout = 'row',
  hideLabel,
}: SegmentedProps<V>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (i + delta + options.length) % options.length;
    onChange(options[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <div className="flex flex-col gap-0.5">
      <span id={`${id}-l`} className={cx('text-small font-medium', hideLabel && 'sr-only')}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-l`}
        className={cx(
          layout === 'row'
            ? 'grid grid-cols-[repeat(auto-fit,minmax(88px,1fr))] gap-0.5 rounded-control bg-surface-2 p-0.5'
            : 'flex flex-col gap-0.5',
        )}
      >
        {options.map((o, i) => {
          const checked = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cx(
                'rounded-control text-small transition-colors duration-(--dur-quick)',
                layout === 'row'
                  ? cx(
                      'min-h-5 whitespace-nowrap px-1',
                      checked ? 'bg-text text-bg font-medium' : 'text-muted hover:text-text',
                    )
                  : cx(
                      'flex items-start gap-1 border px-1.5 py-1 text-left',
                      checked
                        ? 'border-accent-ink bg-surface-2'
                        : 'border-line hover:border-line-strong',
                    ),
              )}
            >
              {layout === 'stack' && (
                <span
                  aria-hidden="true"
                  className={cx(
                    'mt-0.5 size-2 shrink-0 rounded-pill border-2',
                    checked ? 'border-accent-ink bg-accent' : 'border-line-strong',
                  )}
                />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={cx(
                    layout === 'stack' && 'flex items-baseline justify-between gap-1 font-medium',
                  )}
                >
                  {o.label}
                </span>
                {o.hint && <span className="text-caption text-muted">{o.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
