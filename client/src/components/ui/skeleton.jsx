import { cn } from '../../lib/cn';

export function Skeleton({ className, ...props }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-gradient-to-r from-white/6 via-white/12 to-white/6 dark:from-white/6 dark:via-white/12 dark:to-white/6',
        className
      )}
      {...props}
    />
  );
}
