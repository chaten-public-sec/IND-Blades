import { Slot } from '@radix-ui/react-slot';
import { cn } from '../../lib/cn';

const variantClasses = {
  default:
    'bg-gradient-to-r from-cyan-400 via-sky-400 to-teal-300 text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.22)] hover:brightness-105',
  secondary: 'surface-soft text-slate-100 hover:border-cyan-300/30 hover:bg-slate-900/80',
  outline: 'border border-white/12 bg-transparent text-slate-100 hover:border-cyan-300/30 hover:bg-cyan-400/8',
  ghost: 'border border-transparent bg-transparent text-slate-300 hover:bg-white/6 hover:text-white',
  danger: 'bg-gradient-to-r from-rose-500 to-orange-400 text-white shadow-[0_12px_30px_rgba(244,63,94,0.2)] hover:brightness-105',
  subtle: 'bg-white/6 text-slate-100 hover:bg-white/10'
};

const sizeClasses = {
  sm: 'h-9 rounded-xl px-3.5 text-sm',
  md: 'h-11 rounded-2xl px-4 text-sm',
  lg: 'h-12 rounded-2xl px-5 text-sm',
  icon: 'h-11 w-11 rounded-2xl'
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
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp className={buttonStyles({ variant, size, className })} disabled={disabled || loading} {...props}>
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      ) : null}
      {children}
    </Comp>
  );
}
