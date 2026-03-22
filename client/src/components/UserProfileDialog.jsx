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

function getTimeLeft(expiresAt) {
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days}d ${hours}h`;
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

  const strikes = user.strikes || [];

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[min(96vw,520px)] max-h-[90vh] overflow-y-auto">
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

          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Strikes</p>
              <Badge variant={user.strike_count > 0 ? "destructive" : "success"}>
                {user.strike_count || 0} Strikes
              </Badge>
            </div>
            
            {strikes.length > 0 ? (
              <div className="space-y-3">
                {strikes.map((strike, i) => (
                  <div key={i} className="surface-soft rounded-xl p-3 text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-red-400">{strike.reason}</span>
                      <span className="text-xs text-[var(--text-muted)]">{getTimeLeft(strike.expires_at)} left</span>
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">Given on {formatDate(strike.timestamp)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="surface-soft rounded-xl p-4 text-center text-sm text-[var(--text-muted)]">
                No active strikes. This user is in good standing!
              </div>
            )}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
