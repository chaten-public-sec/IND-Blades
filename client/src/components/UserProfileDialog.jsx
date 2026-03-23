import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from './ui/dialog';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { User, Mic, MessageSquare, Calendar, Trophy, Zap, AlertTriangle, ShieldCheck, History, Trash2, X } from 'lucide-react';

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
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (days > 0) return `${days}d ${hours}h`;
  return `${hours}h ${mins}m`;
}

export default function UserProfileDialog({ user, roles = [], roster = [], onClose }) {
  if (!user) return null;

  const { showToast, handleError } = useDashboardContext();
  const [addingStrike, setAddingStrike] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [addErrors, setAddErrors] = useState({});
  const [removingIdx, setRemovingIdx] = useState(null);

  const userRoleIds = new Set(user.roles || []);
  const userRoles = roles.filter((r) => userRoleIds.has(r.id));

  const ranked = [...roster].sort((a, b) => {
    const bs = (Number(b.voice_time || 0) / 60) * 2 + Number(b.messages || 0);
    const as = (Number(a.voice_time || 0) / 60) * 2 + Number(a.messages || 0);
    return bs - as;
  });
  const rank = ranked.findIndex((u) => u.id === user.id) + 1;

  const strikes = user.strikes || [];

  const validateAdd = () => {
    const e = {};
    if (!reason.trim()) e.reason = 'Mention the violation reason';
    setAddErrors(e);
    return Object.keys(e).length === 0;
  };

  const addStrike = useCallback(async () => {
    if (!validateAdd()) return;
    setAddingStrike(true);
    try {
      await api.post('/api/strikes/add', { user_id: user.id, reason: reason.trim() });
      showToast('Strike issued successfully.', 'success');
      setAddOpen(false);
      setReason('');
    } catch (err) { handleError(err, 'Failed to add strike.'); }
    finally { setAddingStrike(false); }
  }, [user.id, reason, showToast, handleError]);

  const removeStrike = useCallback(async (index) => {
    setRemovingIdx(index);
    try {
      await api.post('/api/strikes/remove', { user_id: user.id, index });
      showToast('Strike removed.');
    } catch (err) { handleError(err, 'Failed to remove strike.'); }
    finally { setRemovingIdx(null); }
  }, [user.id, showToast, handleError]);

  return (
    <>
      <Dialog open={Boolean(user)} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="w-[min(96vw,520px)] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Member Profile</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <div className="relative flex flex-col items-center gap-5 pt-4">
              <div className="relative">
                 <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-800 text-4xl font-black border-2 border-white/5 shadow-2xl overflow-hidden">
                    {(user.name || user.username || 'U').charAt(0).toUpperCase()}
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-transparent" />
                 </div>
                 <div className="absolute -bottom-1 -right-1 rounded-full bg-emerald-500 p-1.5 border-4 border-slate-900 shadow-lg">
                    <ShieldCheck className="h-4 w-4 text-white" />
                 </div>
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black text-[var(--text-main)] tracking-tight">{user.name || user.username}</h3>
                <p className="text-xs font-mono text-[var(--text-muted)] mt-1">ID: {user.id}</p>
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

            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-3xl bg-white/[0.03] border border-white/5 p-4 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center gap-2 mb-1">
                   <Mic className="h-3.5 w-3.5 text-cyan-400" />
                   <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Voice Comm</p>
                </div>
                <p className="text-xl font-black text-cyan-400">{formatDuration(user.voice_time)}</p>
              </div>
              <div className="rounded-3xl bg-white/[0.03] border border-white/5 p-4 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center gap-2 mb-1">
                   <MessageSquare className="h-3.5 w-3.5 text-indigo-400" />
                   <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Messages</p>
                </div>
                <p className="text-xl font-black text-indigo-400">{user.messages || 0}</p>
              </div>
              <div className="rounded-3xl bg-white/[0.03] border border-white/5 p-4 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center gap-2 mb-1">
                   <Calendar className="h-3.5 w-3.5 text-amber-400" />
                   <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Arrival Log</p>
                </div>
                <p className="text-xs font-bold text-[var(--text-main)]">{formatDate(user.joined_at).split(',')[0]}</p>
              </div>
              <div className="rounded-3xl bg-white/[0.03] border border-white/5 p-4 transition-all hover:bg-white/[0.05]">
                <div className="flex items-center gap-2 mb-1">
                   <Trophy className="h-3.5 w-3.5 text-emerald-400" />
                   <p className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Global Rank</p>
                </div>
                <p className="text-xl font-black text-emerald-400">#{rank || '—'}</p>
              </div>
            </div>

            <div className="mt-8">
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                   <History className="h-4 w-4 text-red-400" />
                   <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Violation History</h4>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={user.strike_count > 0 ? "destructive" : "success"} className="h-6 px-3">
                    {user.strike_count || 0} TOTAL
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)} className="h-7 w-7 p-0 rounded-lg hover:bg-white/5">
                     <Zap className="h-4 w-4 text-amber-400" />
                  </Button>
                </div>
              </div>
              
              {strikes.length > 0 ? (
                <div className="space-y-3">
                  {strikes.map((strike, i) => (
                    <div key={i} className="group relative overflow-hidden rounded-2xl border border-white/5 bg-white/3 p-4 transition-all hover:bg-white/5">
                      <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1">
                           <p className="font-bold text-rose-500 text-sm">{strike.reason}</p>
                           <p className="text-[10px] text-[var(--text-muted)] font-medium">Issued {formatDate(strike.timestamp)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={getTimeLeft(strike.expires_at) === 'Expired' ? 'danger' : 'warning'} className="text-[9px]">
                            {getTimeLeft(strike.expires_at)}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-red-500/70 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeStrike(i)}
                            loading={removingIdx === i}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 opacity-50 bg-white/[0.02] rounded-3xl border border-dashed border-white/10">
                   <ShieldCheck className="h-8 w-8 mb-2 text-emerald-500" />
                   <p className="text-xs font-semibold">Zero incidents found.</p>
                </div>
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* Add Strike Mini-Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Strike</DialogTitle>
            <DialogDescription>Add a strike to {user.name || user.username}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className={`text-[10px] font-bold uppercase tracking-widest ${addErrors.reason ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>Incident Description</Label>
                <div className="relative">
                  <input
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); setAddErrors(p => ({ ...p, reason: '' })); }}
                    placeholder="Briefly state the violation..."
                    autoFocus
                    className={`surface-soft h-12 w-full rounded-2xl pl-11 pr-4 text-sm text-[var(--text-main)] transition-all outline-none ${addErrors.reason ? 'border-red-500/50 bg-red-500/5' : 'focus:border-cyan-500/30'}`}
                  />
                  <AlertTriangle className={`absolute left-4 top-3.5 h-5 w-5 ${addErrors.reason ? 'text-red-400' : 'text-[var(--text-muted)]'}`} />
                </div>
                {addErrors.reason && <p className="text-[10px] font-medium text-red-400">{addErrors.reason}</p>}
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={addStrike} loading={addingStrike}>Add Strike</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
