import { Clock3 } from 'lucide-react';
import { cn } from '../../lib/cn';

export function TimeInput({ className, ...props }) {
  return (
    <div className="relative">
      <input
        type="time"
        className={cn(
          'surface-soft h-11 w-full rounded-2xl px-4 pl-11 text-sm text-[var(--text-main)] transition focus:border-[rgba(49,94,251,0.28)] focus:bg-[var(--card-bg)]',
          className
        )}
        {...props}
      />
      <Clock3 className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
    </div>
  );
}
