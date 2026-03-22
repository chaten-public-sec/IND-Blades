import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from './ui/dialog';
import { Badge } from './ui/badge';

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
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

export default function UserProfileDialog({ user, roles = [], roster = [], onClose }) {
  if (!user) return null;

  const userRoleIds = new Set(user.roles || []);
  const userRoles = roles.filter((r) => userRoleIds.has(r.id));

  // Calculate rank
  const ranked = [...roster].sort((a, b) => {
    const bs = (Number(b.voice_time || 0) / 60) * 2 + Number(b.messages || 0);
    const as = (Number(a.voice_time || 0) / 60) * 2 + Number(a.messages || 0);
    return bs - as;
  });
  const rank = ranked.findIndex((u) => u.id === user.id) + 1;

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(96vw,520px)]">
        <DialogHeader>
          <DialogTitle>Member Profile</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/30 to-teal-300/30 text-3xl font-bold shadow-lg">
              {(user.name || user.username || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold">{user.name || user.username}</h3>
              {user.username && <p className="text-sm text-[var(--text-muted)]">@{user.username}</p>}
            </div>
          </div>

          {userRoles.length > 0 && (
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Roles</p>
              <div className="flex flex-wrap gap-2">
                {userRoles.map((r) => <Badge key={r.id} variant="default">{r.name}</Badge>)}
              </div>
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="surface-soft rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Voice Time</p>
              <p className="mt-2 text-2xl font-bold">{formatDuration(user.voice_time)}</p>
            </div>
            <div className="surface-soft rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Messages</p>
              <p className="mt-2 text-2xl font-bold">{user.messages || 0}</p>
            </div>
            <div className="surface-soft rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Joined</p>
              <p className="mt-2 text-sm font-semibold">{formatDate(user.joined_at)}</p>
            </div>
            <div className="surface-soft rounded-2xl p-4 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Rank</p>
              <p className="mt-2 text-2xl font-bold text-gradient">#{rank || '—'}</p>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
