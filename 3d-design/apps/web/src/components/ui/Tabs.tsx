import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from './cx';

interface TabsProps<V extends string> {
  label: string;
  value: V;
  onChange: (v: V) => void;
  tabs: { value: V; label: ReactNode }[];
  /** Render prop gets the ids to wire the active panel. */
  children: (panel: { id: string; labelledBy: string }) => ReactNode;
}

export function Tabs<V extends string>({ label, value, onChange, tabs, children }: TabsProps<V>) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = tabs.length - 1;
    if (next < 0) return;
    e.preventDefault();
    onChange(tabs[next]!.value);
    refs.current[next]?.focus();
  };
  return (
    <>
      <div role="tablist" aria-label={label} className="flex border-b border-line bg-surface">
        {tabs.map((tab, i) => {
          const selected = tab.value === value;
          return (
            <button
              key={tab.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              id={`${id}-tab-${tab.value}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${id}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.value)}
              onKeyDown={(e) => onKey(e, i)}
              className={cx(
                'min-h-6 flex-1 border-b-2 text-small font-medium -mb-px',
                selected
                  ? 'border-accent-ink text-text'
                  : 'border-transparent text-muted hover:text-text',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {children({ id: `${id}-panel`, labelledBy: `${id}-tab-${value}` })}
    </>
  );
}
