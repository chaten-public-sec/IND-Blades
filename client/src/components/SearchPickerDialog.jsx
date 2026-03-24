import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { cn } from '../lib/cn';

export default function SearchPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  items,
  selectedIds = [],
  onConfirm,
  multiple = false,
  confirmLabel = 'Save',
  placeholder = 'Search',
}) {
  const [query, setQuery] = useState('');
  const [localSelection, setLocalSelection] = useState(selectedIds);

  useEffect(() => {
    if (open) {
      setLocalSelection(selectedIds);
      setQuery('');
    }
  }, [open, selectedIds]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) =>
      `${item.label} ${item.description || ''}`.toLowerCase().includes(term)
    );
  }, [items, query]);

  const toggleItem = (id) => {
    setLocalSelection((current) => {
      if (multiple) {
        return current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id];
      }
      return current.includes(id) ? [] : [id];
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,680px)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogBody>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              className="surface-soft h-12 w-full rounded-[18px] pl-11 pr-4 text-sm text-[var(--text-main)] placeholder:text-[var(--text-muted)]"
            />
          </div>
          <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-soft)] p-2">
            <div className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-[var(--text-muted)]">
              <span>{filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}</span>
              <span>{localSelection.length ? `${localSelection.length} selected` : 'Select an option'}</span>
            </div>
            <div className="grid gap-2">
            {filteredItems.map((item) => {
              const active = localSelection.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={cn(
                    'flex items-start justify-between gap-4 rounded-[18px] border px-4 py-3 text-left transition',
                    active
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                      : 'border-[var(--border)] bg-[var(--card-bg)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-panel)]'
                  )}
                >
                  <div className="space-y-1">
                    <p className="font-semibold text-[var(--text-main)]">{item.label}</p>
                    {item.description ? (
                      <p className="text-sm leading-6 text-[var(--text-soft)]">{item.description}</p>
                    ) : null}
                  </div>
                  <div className={cn(
                    'mt-1 h-5 w-5 rounded-full border transition',
                    active ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-[var(--border)] bg-transparent'
                  )} />
                </button>
              );
            })}
            {filteredItems.length === 0 ? (
              <div className="rounded-[18px] border border-dashed border-[var(--border)] px-5 py-8 text-center text-sm text-[var(--text-muted)]">
                No matches found.
              </div>
            ) : null}
            </div>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => {
              onConfirm(localSelection);
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
