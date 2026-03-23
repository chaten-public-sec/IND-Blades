import { useState, useEffect } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { SelectField } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
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
          <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Activity</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Weekly leaderboard · Voice time, messages, activity score. Last reset: {lastReset}</p>
        </div>
        <Button variant="danger" onClick={() => setResetDialogOpen(true)}>Reset Week</Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-[var(--text-main)]">AFK Channel</h3>
          <p className="mt-1 mb-3 text-sm text-[var(--text-muted)]">Voice time in this channel is excluded from activity tracking.</p>
          <div className="flex flex-wrap items-center gap-3">
            <SelectField value={afkChannelId} onChange={(e) => setAfkChannelId(e.target.value)} className="w-64">
              <option value="">None (use server default)</option>
              {((channels || []).filter((c) => c.type === 2).length ? (channels || []).filter((c) => c.type === 2) : (channels || [])).map((c) => (
                <option key={c.id} value={c.id}>#{c.name}</option>
              ))}
            </SelectField>
            <Button size="sm" onClick={saveActivityConfig} loading={configSaving}>Save</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((user, i) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="flex w-full items-center gap-4 rounded-2xl p-3 text-left transition hover:bg-white/4"
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl text-sm font-bold ${
                    i === 0 ? 'bg-amber-400/20 text-amber-200' :
                    i === 1 ? 'bg-slate-300/20 text-slate-200' :
                    i === 2 ? 'bg-orange-400/20 text-orange-200' :
                    'bg-white/5 text-[var(--text-muted)]'
                  }`}>
                    {i + 1}
                  </span>

                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400/20 to-teal-300/20 text-sm font-bold">
                    {(user.name || 'U').charAt(0).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{user.name || user.username}</p>
                    <p className="text-xs text-[var(--text-muted)]">{formatDuration(user.voice_time)} voice · {user.messages} msgs</p>
                  </div>

                  <Badge variant={i < 3 ? 'success' : 'neutral'}>{user.score} XP</Badge>
                </button>
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-[var(--text-muted)]">No activity recorded yet.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Activity Stats</DialogTitle>
            <DialogDescription>This will permanently reset all weekly activity stats. This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetDialogOpen(false)}>Cancel</Button>
            <Button variant="danger" onClick={resetStats}>Reset Week</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserProfileDialog user={selectedUser} roles={roles} roster={roster} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
