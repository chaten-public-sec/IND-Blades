import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '../../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogPortal({ children }) {
  return <DialogPrimitive.Portal>{children}</DialogPrimitive.Portal>;
}

export function DialogOverlay({ className, ...props }) {
  return (
    <DialogPrimitive.Overlay
      className={cn('fixed inset-0 z-50 bg-black/60 dark:bg-slate-950/82 backdrop-blur-md', className)}
      {...props}
    />
  );
}

export function DialogContent({ className, children, showClose = true, ...props }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'surface-highlight fixed left-1/2 top-1/2 z-50 w-[min(96vw,760px)] -translate-x-1/2 -translate-y-1/2 rounded-[30px] p-0 text-[var(--text-main)] shadow-[0_32px_120px_rgba(0,0,0,0.15)] dark:shadow-[0_32px_120px_rgba(2,6,23,0.78)]',
          className
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-black/5 dark:bg-white/5 text-[var(--text-muted)] transition hover:bg-black/10 dark:hover:bg-white/10 hover:text-[var(--text-main)]">
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

export function DialogHeader({ className, ...props }) {
  return <div className={cn('space-y-2 border-b border-[var(--border)] px-6 py-6 sm:px-8', className)} {...props} />;
}

export function DialogTitle({ className, ...props }) {
  return <DialogPrimitive.Title className={cn('text-2xl font-semibold text-[var(--text-main)]', className)} {...props} />;
}

export function DialogDescription({ className, ...props }) {
  return <DialogPrimitive.Description className={cn('text-sm text-[var(--text-muted)]', className)} {...props} />;
}

export function DialogBody({ className, ...props }) {
  return <div className={cn('max-h-[70vh] space-y-6 overflow-y-auto px-6 py-6 sm:px-8', className)} {...props} />;
}

export function DialogFooter({ className, ...props }) {
  return <div className={cn('flex flex-col-reverse gap-3 border-t border-[var(--border)] px-6 py-5 sm:flex-row sm:justify-end sm:px-8', className)} {...props} />;
}
