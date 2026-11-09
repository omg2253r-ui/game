import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button, type ButtonVariant } from './Button';

interface ModalProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

/**
 * Native <dialog> + showModal(): focus is trapped, Escape closes, the rest of
 * the page is inert, and focus returns to the opener — without a library.
 */
export function Modal({ open, title, children, onClose, footer }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      // React's autoFocus fires while the dialog is still closed, so focus here.
      d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);
  return (
    // Backdrop click is a mouse shortcut; Escape (native) is the keyboard path.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose(); // backdrop click
      }}
      className="m-auto w-[min(480px,calc(100vw-32px))] rounded-overlay border border-line bg-surface p-0 text-text shadow-overlay z-(--z-modal)"
    >
      <div className="flex flex-col gap-2 p-3">
        <h2 id={titleId} className="text-h2 font-semibold">
          {title}
        </h2>
        <div className="text-body text-muted">{children}</div>
        {footer && <div className="mt-1 flex flex-wrap justify-end gap-1">{footer}</div>}
      </div>
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  variant?: Extract<ButtonVariant, 'primary' | 'danger'>;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  busy,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          {/* Initial focus goes to the safe choice: Cancel for destructive dialogs. */}
          <Button
            variant="ghost"
            onClick={onCancel}
            data-autofocus={variant === 'danger' || undefined}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={onConfirm}
            disabled={busy}
            data-autofocus={variant !== 'danger' || undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
