import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'sm';

const VARIANT: Record<ButtonVariant, string> = {
  // The one tape-yellow action per screen.
  primary: 'bg-accent text-on-accent hover:bg-accent-hover font-semibold',
  secondary: 'bg-surface-2 text-text border border-line-strong hover:border-muted',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'bg-danger text-bg font-semibold hover:opacity-90',
};

const SIZE: Record<ButtonSize, string> = {
  md: 'min-h-5 px-2 text-small gap-1',
  sm: 'min-h-4 px-1.5 text-small gap-0.5',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  block?: boolean;
  children: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    block,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'inline-flex items-center justify-center rounded-control transition-colors duration-(--dur-quick)',
        'disabled:opacity-50 disabled:pointer-events-none',
        VARIANT[variant],
        SIZE[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      <span>{children}</span>
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  pressed?: boolean;
  variant?: 'ghost' | 'secondary' | 'overlay';
}

export function IconButton({
  icon,
  label,
  pressed,
  variant = 'ghost',
  className,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      className={cx(
        'inline-flex size-5 items-center justify-center rounded-control transition-colors duration-(--dur-quick)',
        'disabled:opacity-50',
        variant === 'ghost' && 'text-muted hover:text-text hover:bg-surface-2',
        variant === 'secondary' &&
          'border border-line bg-surface-2 text-text hover:border-line-strong',
        variant === 'overlay' && 'bg-bg/80 text-text hover:bg-bg backdrop-blur-sm',
        pressed && 'text-accent-ink! bg-surface-2',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}
