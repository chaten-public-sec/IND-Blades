import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/cn';

export function SelectField({ className, icon = true, children, ...props }) {
  return (
    <div className="relative">
      <select
        className={cn(
          'surface-soft h-11 w-full appearance-none rounded-2xl px-4 pr-11 text-sm text-slate-100 transition focus:border-cyan-300/30 focus:bg-slate-950/90',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {icon ? (
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      ) : null}
    </div>
  );
}
