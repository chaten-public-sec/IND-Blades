import { cn } from '../../lib/cn';

const variants = {
  default: 'border-cyan-500/30 bg-cyan-500/15 text-cyan-700 dark:text-cyan-100',
  success: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-100',
  warning: 'border-amber-500/30 bg-amber-500/15 text-amber-700 dark:text-amber-100',
  danger: 'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:text-rose-100',
  neutral: 'border-[var(--border)] bg-black/5 dark:bg-white/6 text-[var(--text-main)]'
};

export function Badge({ className, variant = 'default', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
        variants[variant] || variants.default,
        className
      )}
      {...props}
    />
  );
}
