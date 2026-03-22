import { cn } from '../../lib/cn';

const variants = {
  default: 'border-cyan-300/20 bg-cyan-300/10 text-cyan-100',
  success: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-100',
  warning: 'border-amber-300/20 bg-amber-300/10 text-amber-100',
  danger: 'border-rose-300/20 bg-rose-300/10 text-rose-100',
  neutral: 'border-white/12 bg-white/6 text-slate-200'
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
