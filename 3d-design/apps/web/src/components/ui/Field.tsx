import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';

const control =
  'w-full rounded-control border border-line-strong bg-surface-2 px-1.5 text-body text-text placeholder:text-muted ' +
  'hover:border-muted focus-visible:border-accent-ink aria-invalid:border-danger';

interface FieldProps {
  label: ReactNode;
  help?: ReactNode;
  error?: ReactNode;
  /** Right-aligned text next to the label, e.g. a character counter. */
  aside?: ReactNode;
  hideLabel?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

export function Field({ label, help, error, aside, hideLabel, children }: FieldProps) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [errId, helpId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-0.5">
      <div className={cx('flex items-baseline justify-between gap-1', hideLabel && 'sr-only')}>
        <label htmlFor={id} className="text-small font-medium">
          {label}
        </label>
        {aside && <span className="text-caption text-muted num">{aside}</span>}
      </div>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && (
        <p id={errId} className="text-caption text-danger">
          {error}
        </p>
      )}
      {help && (
        <p id={helpId} className="text-caption text-muted">
          {help}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return <input ref={ref} className={cx(control, 'min-h-5', className)} {...rest} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea ref={ref} className={cx(control, 'py-1 resize-y min-h-14', className)} {...rest} />
  );
});
