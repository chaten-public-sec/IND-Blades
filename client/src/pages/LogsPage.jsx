import { useState } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/table';

function formatDate(v) {
  if (!v) return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

const LEVEL_VARIANT = { warning: 'warning', error: 'danger', info: 'default' };

export default function LogsPage() {
  const { logs } = useDashboardContext();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = logs.filter((log) => {
    if (filter !== 'all' && log.source !== filter) return false;
    if (search && !log.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const sources = [...new Set(logs.map((l) => l.source))].sort();

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Logs</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{logs.length} entries</p>
        </div>
        <div className="flex gap-3">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="surface-soft h-10 rounded-2xl px-4 text-sm text-[var(--text-main)] appearance-none"
          >
            <option value="all">All Sources</option>
            {sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="surface-soft h-10 w-48 rounded-2xl px-4 text-sm text-[var(--text-main)] transition focus:border-cyan-300/30"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Level</TableHeaderCell>
                <TableHeaderCell>Source</TableHeaderCell>
                <TableHeaderCell>Message</TableHeaderCell>
                <TableHeaderCell>Time</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id}>
                  <TableCell><Badge variant={LEVEL_VARIANT[log.level] || 'neutral'}>{log.level}</Badge></TableCell>
                  <TableCell className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">{log.source}</TableCell>
                  <TableCell className="max-w-md truncate text-sm">{log.message}</TableCell>
                  <TableCell className="text-xs text-[var(--text-muted)] whitespace-nowrap">{formatDate(log.timestamp)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-12 text-center text-[var(--text-muted)]">No logs found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
