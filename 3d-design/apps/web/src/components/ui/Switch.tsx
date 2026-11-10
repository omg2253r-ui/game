import { useId, type ReactNode } from 'react';
import { cx } from './cx';

interface SwitchProps {
  label: ReactNode;
  help?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export function Switch({ label, help, checked, onChange, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col">
        <label htmlFor={id} className="text-small font-medium">
          {label}
        </label>
        {help && (
          <p id={`${id}-h`} className="text-caption text-muted">
            {help}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={help ? `${id}-h` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-3 w-5 shrink-0 items-center rounded-pill border transition-colors duration-(--dur-quick)',
          'disabled:opacity-50',
          checked ? 'border-accent-ink bg-accent' : 'border-line-strong bg-surface-2',
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            'absolute size-2 rounded-pill transition-transform duration-(--dur-quick)',
            checked ? 'translate-x-[20px] bg-on-accent' : 'translate-x-[3px] bg-muted',
          )}
        />
      </button>
    </div>
  );
}
