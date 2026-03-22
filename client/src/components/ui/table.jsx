import { cn } from '../../lib/cn';

export function Table({ className, ...props }) {
  return <div className={cn('overflow-x-auto', className)}><table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm" {...props} /></div>;
}

export function TableHead({ className, ...props }) {
  return <thead className={cn('text-xs uppercase tracking-[0.2em] text-slate-500', className)} {...props} />;
}

export function TableBody({ className, ...props }) {
  return <tbody className={cn('text-slate-100', className)} {...props} />;
}

export function TableRow({ className, ...props }) {
  return <tr className={cn('transition hover:bg-white/3', className)} {...props} />;
}

export function TableHeaderCell({ className, ...props }) {
  return <th className={cn('border-b border-white/10 px-4 py-3 font-semibold', className)} {...props} />;
}

export function TableCell({ className, ...props }) {
  return <td className={cn('border-b border-white/8 px-4 py-4 align-top', className)} {...props} />;
}
