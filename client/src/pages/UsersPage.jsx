import { useState } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/table';
import UserProfileDialog from '../components/UserProfileDialog';

function formatDuration(s) {
  const t = Number(s || 0);
  if (!t) return '0m';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function formatDate(v) {
  if (!v) return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}

export default function UsersPage() {
  const { roster, roles } = useDashboardContext();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const filtered = roster.filter((u) =>
    `${u.name || ''} ${u.username || ''} ${u.id || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Members</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{roster.length} total members</p>
        </div>
        <input
          placeholder="Search members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="surface-soft h-11 w-full rounded-2xl px-4 text-sm text-[var(--text-main)] transition focus:border-cyan-300/30 sm:w-64"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Member</TableHeaderCell>
                <TableHeaderCell>Joined</TableHeaderCell>
                <TableHeaderCell>Voice</TableHeaderCell>
                <TableHeaderCell>Messages</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id} className="cursor-pointer" onClick={() => setSelectedUser(user)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-teal-300/20 text-sm font-bold">
                        {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold">{user.name || user.username}</p>
                        {user.username && <p className="text-xs text-[var(--text-muted)]">@{user.username}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(user.joined_at)}</TableCell>
                  <TableCell className="text-sm">{formatDuration(user.voice_time)}</TableCell>
                  <TableCell className="text-sm">{user.messages}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={4} className="py-12 text-center text-[var(--text-muted)]">No members found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserProfileDialog user={selectedUser} roles={roles} roster={roster} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
