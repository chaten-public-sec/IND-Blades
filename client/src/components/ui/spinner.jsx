import { cn } from '../../lib/cn';

export function Spinner({ className }) {
  return (
    <span
      className={cn(
        'inline-block h-5 w-5 animate-spin rounded-full border-2 border-current/20 border-t-current',
        className
      )}
    />
  );
}
