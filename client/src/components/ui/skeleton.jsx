import { cn } from '../../lib/cn';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-800/70 to-slate-900/90',
        className
      )}
      {...props}
    />
  );
}
