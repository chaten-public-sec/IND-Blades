import { cn } from '../../lib/cn';

export function Card({ className, ...props }) {
  return <div className={cn('surface rounded-[24px]', className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-2 p-6', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
  return <h3 className={cn('text-lg font-semibold text-[var(--text-main)]', className)} {...props} />;
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm leading-6 text-[var(--text-muted)]', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
  return <div className={cn('px-6 pb-6', className)} {...props} />;
}

export function CardFooter({ className, ...props }) {
  return <div className={cn('flex items-center gap-3 px-6 pb-6 pt-2', className)} {...props} />;
}
