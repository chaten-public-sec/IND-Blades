import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '../../lib/cn';

export const Tabs = TabsPrimitive.Root;

export function TabsList({ className, ...props }) {
  return <TabsPrimitive.List className={cn('inline-flex rounded-2xl border border-white/10 bg-white/5 p-1', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-slate-400 transition data-[state=active]:bg-white data-[state=active]:text-slate-950',
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }) {
  return <TabsPrimitive.Content className={cn('outline-none', className)} {...props} />;
}
