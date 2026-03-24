import { cn } from '../../lib/cn';

const variants = {
  default: 'border-blue-400/20 bg-blue-500/12 text-blue-700 dark:text-blue-100',
  success: 'border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-100',
  warning: 'border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-100',
  danger: 'border-rose-500/20 bg-rose-500/12 text-rose-700 dark:text-rose-100',
  neutral: 'border-[var(--border)] bg-[var(--bg-soft)] text-[var(--text-main)]'
};

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  );
}
