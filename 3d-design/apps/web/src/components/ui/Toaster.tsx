import { useT } from '../../i18n';
import { useToasts } from '../../stores/toasts';
import { cx } from './cx';
import { Icon } from './Icon';

export function Toaster() {
  const t = useT();
  const { items, dismiss } = useToasts();
  return (
    <section
      aria-label={t('toast.region')}
      className="pointer-events-none fixed inset-x-2 bottom-2 flex flex-col items-center gap-1 sm:left-auto sm:right-2 sm:items-end z-(--z-toast)"
    >
      {/* Polite for progress/success; errors are assertive so screen readers interrupt. */}
      <div aria-live="polite" className="contents">
        {items
          .filter((x) => x.kind !== 'error')
          .map((x) => (
            <ToastItem
              key={x.id}
              kind={x.kind}
              message={x.message}
              onDismiss={() => dismiss(x.id)}
              closeLabel={t('common.close')}
            />
          ))}
      </div>
      <div role="alert" className="contents">
        {items
          .filter((x) => x.kind === 'error')
          .map((x) => (
            <ToastItem
              key={x.id}
              kind={x.kind}
              message={x.message}
              onDismiss={() => dismiss(x.id)}
              closeLabel={t('common.close')}
            />
          ))}
      </div>
    </section>
  );
}

function ToastItem({
  kind,
  message,
  onDismiss,
  closeLabel,
}: {
  kind: 'info' | 'success' | 'error';
  message: string;
  onDismiss: () => void;
  closeLabel: string;
}) {
  return (
    <div
      className={cx(
        'toast-in pointer-events-auto flex w-full max-w-[400px] items-start gap-1 rounded-overlay border bg-surface px-1.5 py-1 text-small shadow-overlay',
        kind === 'error' ? 'border-danger' : 'border-line',
      )}
    >
      <Icon
        name={kind === 'error' ? 'alert' : kind === 'success' ? 'check' : 'info'}
        className={cx(
          'mt-0.5 shrink-0',
          kind === 'error' ? 'text-danger' : kind === 'success' ? 'text-ok' : 'text-muted',
        )}
      />
      <p className="flex-1">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={closeLabel}
        className="-mr-0.5 rounded-control p-0.5 text-muted hover:text-text"
      >
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}
