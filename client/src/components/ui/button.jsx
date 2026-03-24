import { cloneElement, isValidElement } from 'react';
import { cn } from '../../lib/cn';

const variantClasses = {
  default:
    'bg-[var(--primary)] text-white shadow-[0_18px_34px_-20px_rgba(49,94,251,0.9)] hover:bg-[var(--primary-strong)]',
  secondary: 'border border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-main)] hover:border-[var(--border-strong)] hover:bg-white/10 dark:hover:bg-white/8',
  outline: 'border border-[var(--border)] bg-transparent text-[var(--text-main)] hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]',
  ghost: 'border border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-soft)] hover:text-[var(--text-main)]',
  danger: 'bg-rose-500 text-white shadow-[0_18px_34px_-20px_rgba(244,63,94,0.9)] hover:bg-rose-600',
  subtle: 'bg-[var(--bg-soft)] text-[var(--text-main)] hover:bg-white/10 dark:hover:bg-white/8'
};

const sizeClasses = {
  sm: 'h-9 rounded-xl px-3.5 text-sm',
  md: 'h-11 rounded-[16px] px-4 text-sm',
  lg: 'h-12 rounded-[18px] px-5 text-sm',
  icon: 'h-11 w-11 rounded-[16px]'
};

export function buttonStyles({ variant = 'default', size = 'md', className } = {}) {
  return cn(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition duration-200 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.99]',
    variantClasses[variant] || variantClasses.default,
    sizeClasses[size] || sizeClasses.md,
    className
  );
}

export function Button({
  asChild = false,
  className,
  variant = 'default',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}) {
  const content = (
    <>
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : null}
      {asChild && isValidElement(children) ? children.props.children : children}
    </>
  );

  if (asChild) {
    if (!isValidElement(children)) {
      throw new Error('Button with asChild expects a single React element child.');
    }

    return cloneElement(children, {
      ...props,
      className: buttonStyles({ variant, size, className: cn(children.props.className, className) }),
      'aria-disabled': disabled || loading ? 'true' : undefined,
      onClick: (event) => {
        if (disabled || loading) {
          event.preventDefault();
          return;
        }
        children.props.onClick?.(event);
        props.onClick?.(event);
      },
      children: content
    });
  }

  return (
    <button className={buttonStyles({ variant, size, className })} disabled={disabled || loading} {...props}>
      {content}
    </button>
  );
}
