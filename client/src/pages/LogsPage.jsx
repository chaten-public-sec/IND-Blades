import { useState, useMemo } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ScrollText, Trash2, Search, Filter } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../components/ui/dialog';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/table';

function formatDate(v) {
  if (!v) return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

const LEVEL_VARIANT = { warning: 'warning', error: 'danger', info: 'default' };
const PAGE_SIZE = 25;

export default function LogsPage() {
  const { logs, showToast, handleError } = useDashboardContext();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (filter !== 'all' && log.source !== filter) return false;
      if (levelFilter !== 'all' && log.level !== levelFilter) return false;
      if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [logs, filter, levelFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pageItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const sources = [...new Set(logs.map((l) => l.source))].sort();

  const clearLogs = async () => {
    setClearing(true);
    try {
      await api.post('/api/logs/clear');
      showToast('Logs cleared.');
      setClearOpen(false);
    } catch (err) { handleError(err, 'Failed to clear logs.'); }
    finally { setClearing(false); }
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Logs</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{filtered.length} of {logs.length} entries</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={levelFilter}
            onChange={(e) => { setLevelFilter(e.target.value); setPage(0); }}
            className="surface-soft h-10 rounded-2xl px-4 text-sm text-[var(--text-main)] appearance-none"
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <select
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setPage(0); }}
            className="surface-soft h-10 rounded-2xl px-4 text-sm text-[var(--text-main)] appearance-none"
          >
            <option value="all">All Sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="surface-soft h-10 w-48 rounded-2xl px-4 text-sm text-[var(--text-main)] transition focus:border-cyan-300/30"
          />
          <Button variant="danger" size="sm" onClick={() => setClearOpen(true)} disabled={logs.length === 0}>
            Clear Logs
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHead>
                <TableRow className="bg-[var(--bg-sidebar)]/50">
                  <TableHeaderCell className="w-[100px]">Level</TableHeaderCell>
                  <TableHeaderCell className="w-[120px]">Source</TableHeaderCell>
                  <TableHeaderCell>Message</TableHeaderCell>
                  <TableHeaderCell className="w-[180px] text-right">Time</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageItems.map((log) => (
                  <TableRow key={log.id} className="group hover:bg-white/3 transition-colors">
                    <TableCell><Badge variant={LEVEL_VARIANT[log.level] || 'neutral'}>{log.level}</Badge></TableCell>
                    <TableCell>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] bg-white/5 px-2 py-0.5 rounded-full">
                        {log.source}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md truncate text-sm font-medium">{log.message}</TableCell>
                    <TableCell className="text-[11px] font-medium text-[var(--text-muted)] text-right tabular-nums">
                      {formatDate(log.timestamp)}
                    </TableCell>
                  </TableRow>
                ))}
                {pageItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <ScrollText className="h-10 w-10" />
                        <p className="text-sm font-medium">No log entries found.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button size="sm" variant="ghost" disabled={currentPage === 0} onClick={() => setPage(p => p - 1)}>← Prev</Button>
          <span className="text-sm text-[var(--text-muted)]">Page {currentPage + 1} of {totalPages}</span>
          <Button size="sm" variant="ghost" disabled={currentPage >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</Button>
        </div>
      )}

      {/* Clear Logs Confirmation */}
      <Dialog open={clearOpen} onOpenChange={setClearOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear All Logs</DialogTitle>
            <DialogDescription>This will permanently delete all log entries. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="surface-soft rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{logs.length}</p>
              <p className="text-sm text-[var(--text-muted)]">entries will be deleted</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setClearOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={clearLogs} loading={clearing}>Clear All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
