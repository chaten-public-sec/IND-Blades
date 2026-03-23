import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { SelectField } from '../components/ui/select';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogBody } from '../components/ui/dialog';
import { Trophy, Mic, MessageSquare, Shield, Clock, RotateCcw, Activity, MapPin, Hash } from 'lucide-react';
import UserProfileDialog from '../components/UserProfileDialog';

function formatDuration(s) {
  const t = Number(s || 0);
  if (!t) return '0m';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function ActivityPage() {
  const { roster, activity, activityConfig, setActivityConfig, channels, roles, showToast, handleError } = useDashboardContext();
  const [selectedUser, setSelectedUser] = useState(null);
  const [afkChannelId, setAfkChannelId] = useState(activityConfig?.afk_channel_id || '');
  const [configSaving, setConfigSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  useEffect(() => {
    setAfkChannelId(activityConfig?.afk_channel_id || '');
  }, [activityConfig]);

  const saveActivityConfig = async () => {
    setConfigSaving(true);
    try {
      const r = await api.post('/api/activity/config', { afk_channel_id: afkChannelId || null });
      setActivityConfig(r.data?.config || {});
      showToast('Activity config saved.');
    } catch (err) { handleError(err, 'Failed to save.'); }
    finally { setConfigSaving(false); }
  };


  const leaderboard = [...roster]
    .map((u) => ({ ...u, score: Math.floor((Number(u.voice_time || 0) / 60) * 2 + Number(u.messages || 0)) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  const resetStats = async () => {
    try {
      await api.post('/api/activity/reset');
      showToast('Activity stats reset.');
      setResetDialogOpen(false);
    } catch (err) { handleError(err, 'Failed to reset.'); }
  };

  const lastReset = activity.last_reset
    ? new Date(activity.last_reset * 1000).toLocaleDateString()
    : 'Never';

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-main)]">Engagement Intelligence</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)] font-medium">Weekly leaderboard analytics · Reset cycle: <span className="text-cyan-400 font-bold">{lastReset}</span></p>
        </div>
        <Button variant="danger" size="sm" onClick={() => setResetDialogOpen(true)} className="gap-2 h-10 px-5 shadow-lg shadow-red-500/10">
           <RotateCcw className="h-4 w-4" />
           Reset Cycle
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-4">
               <div className="rounded-xl bg-orange-500/10 p-2 text-orange-400">
                  <MapPin className="h-5 w-5" />
               </div>
               <div>
                  <h3 className="font-bold text-[var(--text-main)]">AFK Threshold</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Exclusion Zone</p>
               </div>
            </div>
            <p className="text-sm text-[var(--text-muted)] mb-6 leading-relaxed">
              Voice time recorded in this channel will be ignored by the intelligence engine.
            </p>
            <div className="space-y-4">
               <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Target Channel</Label>
                  <div className="relative">
                     <SelectField value={afkChannelId} onChange={(e) => setAfkChannelId(e.target.value)} className="pl-10 h-11">
                       <option value="">None (Server Default)</option>
                       {((channels || []).filter((c) => c.type === 2).length ? (channels || []).filter((c) => c.type === 2) : (channels || [])).map((c) => (
                         <option key={c.id} value={c.id}>#{c.name}</option>
                       ))}
                     </SelectField>
                     <Hash className="absolute left-3.5 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
                  </div>
               </div>
               <Button onClick={saveActivityConfig} loading={configSaving} className="w-full">Update Exclusions</Button>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
           <CardContent className="p-0">
             <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="rounded-xl bg-cyan-500/10 p-2 text-cyan-400">
                      <Trophy className="h-5 w-5" />
                   </div>
                   <h3 className="font-bold text-[var(--text-main)]">Global Standing</h3>
                </div>
                <Badge variant="success" className="font-black tracking-widest text-[10px]">LIVE RANKINGS</Badge>
             </div>
             
             <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-2">
               {leaderboard.length > 0 ? (
                 <div className="space-y-1">
                   {leaderboard.map((user, i) => (
                     <button
                       key={user.id}
                       onClick={() => setSelectedUser(user)}
                       className="group flex w-full items-center gap-4 rounded-2xl p-3 text-left transition hover:bg-white/[0.04]"
                     >
                       <div className="flex h-10 w-10 shrink-0 items-center justify-center relative">
                          {i === 0 ? <div className="absolute inset-0 bg-amber-400/20 blur-lg rounded-full animate-pulse" /> : null}
                          <span className={`relative flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black border ${
                            i === 0 ? 'bg-amber-400 border-amber-500/50 text-slate-950 shadow-[0_0_12px_rgba(251,191,36,0.3)]' :
                            i === 1 ? 'bg-slate-300 border-slate-400/50 text-slate-900 shadow-[0_0_12px_rgba(203,213,225,0.3)]' :
                            i === 2 ? 'bg-orange-400 border-orange-500/50 text-slate-900 shadow-[0_0_12px_rgba(251,146,60,0.3)]' :
                            'bg-white/5 border-white/5 text-[var(--text-muted)]'
                          }`}>
                            {i + 1}
                          </span>
                       </div>

                       <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold border border-white/5 overflow-hidden">
                         {(user.name || 'U').charAt(0).toUpperCase()}
                         <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/10 to-transparent" />
                       </div>

                       <div className="min-w-0 flex-1">
                         <p className="truncate font-bold text-[var(--text-main)] group-hover:text-cyan-400 transition-colors">{user.name || user.username}</p>
                         <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">
                               <Mic className="h-3 w-3 text-cyan-400" /> {formatDuration(user.voice_time)}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-tight">
                               <MessageSquare className="h-3 w-3 text-indigo-400" /> {user.messages}
                            </span>
                         </div>
                       </div>

                       <div className="text-right">
                          <p className="text-xs font-black text-emerald-400 group-hover:scale-110 transition-transform">{user.score} XP</p>
                          <p className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-widest mt-0.5">SCORE</p>
                       </div>
                     </button>
                   ))}
                 </div>
               ) : (
                 <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <Activity className="h-12 w-12 mb-4 text-slate-700" />
                    <p className="text-sm font-semibold tracking-wide">No intelligence data points captured for this cycle.</p>
                 </div>
               )}
             </div>
           </CardContent>
        </Card>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Analytics Cycle</DialogTitle>
            <DialogDescription>
               Destructive action: This will permanently purge all weekly engagement metrics. This action is irreversible.
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
             <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 flex items-center gap-3">
                <RotateCcw className="h-5 w-5 text-rose-400" />
                <p className="text-xs font-medium text-rose-200">The leaderboard will be cleared and XP will return to zero for all members.</p>
             </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetDialogOpen(false)}>Abort</Button>
            <Button variant="danger" onClick={resetStats} className="shadow-lg shadow-red-500/20">Purge Data</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserProfileDialog user={selectedUser} roles={roles} roster={roster} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
