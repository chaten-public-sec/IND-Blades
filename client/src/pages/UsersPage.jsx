import { useDashboardContext } from '../lib/DashboardContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/table';
import { Search, User, Clock, MessageSquare, Mic, ExternalLink, Filter } from 'lucide-react';
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
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-main)]">Member Registry</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)] font-medium">{roster.length} members synchronized from Discord</p>
        </div>
        <div className="flex items-center gap-3">
           <div className="relative">
              <input
                placeholder="Search by name, handle or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="surface-soft h-11 w-full rounded-2xl pl-10 pr-4 text-sm text-[var(--text-main)] transition focus:border-cyan-300/30 sm:w-64"
              />
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
           </div>
           <Button variant="ghost" size="sm" className="h-10 w-10 p-0 rounded-2xl border border-[var(--border)] hidden sm:flex">
              <Filter className="h-4 w-4" />
           </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Member Entity</TableHeaderCell>
                <TableHeaderCell>Arrival Date</TableHeaderCell>
                <TableHeaderCell><div className="flex items-center gap-2"><Mic className="h-3 w-3" /> Voice</div></TableHeaderCell>
                <TableHeaderCell><div className="flex items-center gap-2"><MessageSquare className="h-3 w-3" /> Messages</div></TableHeaderCell>
                <TableHeaderCell className="text-right">Intelligence</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id} className="cursor-pointer group" onClick={() => setSelectedUser(user)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold border border-white/5 overflow-hidden">
                        {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-transparent" />
                      </div>
                      <div>
                        <p className="font-bold text-[var(--text-main)] group-hover:text-cyan-400 transition-colors leading-tight">{user.name || user.username}</p>
                        <p className="text-[10px] font-mono text-[var(--text-muted)]">ID: {user.id.slice(-8)}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm font-medium text-[var(--text-muted)]">
                     <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {formatDate(user.joined_at)}</span>
                  </TableCell>
                  <TableCell className="text-sm font-black text-cyan-400/80">{formatDuration(user.voice_time)}</TableCell>
                  <TableCell className="text-sm font-black text-indigo-400/80">{user.messages}</TableCell>
                  <TableCell className="text-right">
                     <Button size="sm" variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ExternalLink className="h-4 w-4 text-cyan-400" />
                     </Button>
                  </TableCell>
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
