import { useMemo, useState } from 'react';
import { RefreshCcw, Trophy, Waves, MessageSquareText, TimerReset, ShieldBan } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/access';
import { formatDuration, formatShortDate } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table';

function ActivityMetric({ icon: Icon, label, value, note }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-main)]">{value}</p>
          {note ? <p className="mt-2 text-sm text-[var(--text-muted)]">{note}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ActivityPage() {
  const dashboard = useDashboardContext();
  const [resetting, setResetting] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const canReset = hasPermission(dashboard.viewer, 'reset_activity');
  const afkChannelIds = dashboard.activityConfig?.afk_channel_ids || (dashboard.activityConfig?.afk_channel_id ? [dashboard.activityConfig.afk_channel_id] : []);
  const topThree = dashboard.leaderboard.slice(0, 3);
  const weeklyScore = Math.round((Number(dashboard.myProfile?.voice_time || 0) / 60) * 2 + Number(dashboard.myProfile?.messages || 0));
  const voiceChannels = useMemo(
    () => dashboard.channels.filter((item) => [2].includes(Number(item.type))),
    [dashboard.channels]
  );
  const afkChannelNames = afkChannelIds
    .map((channelId) => voiceChannels.find((item) => String(item.id) === String(channelId))?.name)
    .filter(Boolean);

  const resetActivity = async () => {
    setResetting(true);
    try {
      await api.post('/api/activity/reset');
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'Weekly activity reset completed.', 'activity-reset');
    } catch (error) {
      dashboard.handleError(error, 'Unable to reset the weekly activity yet.');
    } finally {
      setResetting(false);
    }
  };

  const saveAfkChannels = async (selectedIds) => {
    setConfigSaving(true);
    try {
      await api.post('/api/activity/config', {
        afk_channel_ids: selectedIds,
      });
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'AFK exclusions updated.', 'activity-afk-config');
    } catch (error) {
      dashboard.handleError(error, 'Unable to update AFK exclusions.');
    } finally {
      setConfigSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Activity"
        title="Activity & Leaderboard"
        description="Voice time and messages are tracked automatically, ranked live, and refreshed without a full page reload."
        actions={canReset ? (
          <Button variant="secondary" loading={resetting} onClick={resetActivity}>
            <RefreshCcw className="h-4 w-4" />
            Reset Week
          </Button>
        ) : null}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <ActivityMetric
          icon={TimerReset}
          label="Last Reset"
          value={formatShortDate(dashboard.activity.last_reset * 1000, 'Unknown')}
          note="This resets weekly for the leaderboard cycle."
        />
        <ActivityMetric
          icon={Waves}
          label="My Voice Time"
          value={formatDuration(dashboard.myProfile?.voice_time || 0)}
          note="Tracked voice activity for the current week."
        />
        <ActivityMetric
          icon={MessageSquareText}
          label="My Messages"
          value={dashboard.myProfile?.messages || 0}
          note="Text activity captured this week."
        />
        <ActivityMetric
          icon={Trophy}
          label="Weekly Score"
          value={`${weeklyScore} pts`}
          note="Messages plus weighted voice time."
        />
      </div>

      <Card className="surface-highlight">
        <CardHeader>
          <CardTitle>Top 3 Snapshot</CardTitle>
          <CardDescription>The strongest activity streaks in the current leaderboard window.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          {topThree.length ? topThree.map((user, index) => (
            <div key={user.id} className="surface-soft rounded-[26px] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Rank #{index + 1}</p>
                  <p className="mt-1 font-semibold text-[var(--text-main)]">{user.name}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-1">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Voice</p>
                  <p className="mt-1 text-sm text-[var(--text-main)]">{formatDuration(user.voice_time)}</p>
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Messages</p>
                  <p className="mt-1 text-sm text-[var(--text-main)]">{user.messages}</p>
                </div>
              </div>
              <p className="mt-5 text-2xl font-semibold text-[var(--text-main)]">{user.score} pts</p>
            </div>
          )) : (
            <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)] md:col-span-3">
              No leaderboard activity yet.
            </div>
          )}
        </CardContent>
      </Card>

      {canReset ? (
        <Card>
          <CardHeader>
            <CardTitle>AFK Channel Exclusion</CardTitle>
            <CardDescription>Voice time inside selected AFK channels is ignored from weekly activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-soft rounded-[24px] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[var(--primary-soft)] text-[var(--primary)]">
                  <ShieldBan className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-[var(--text-main)]">Ignored Voice Channels</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {afkChannelNames.length ? afkChannelNames.join(', ') : 'No AFK channels excluded yet.'}
                  </p>
                </div>
              </div>
            </div>
            <Button variant="secondary" loading={configSaving} onClick={() => setPickerOpen(true)}>
              Choose AFK Channels
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>Full weekly ranking across the tracked roster.</CardDescription>
        </CardHeader>
        <CardContent>
          {dashboard.leaderboard.length ? (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Rank</TableHeaderCell>
                  <TableHeaderCell>Member</TableHeaderCell>
                  <TableHeaderCell>Voice Time</TableHeaderCell>
                  <TableHeaderCell>Messages</TableHeaderCell>
                  <TableHeaderCell>Score</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {dashboard.leaderboard.map((user, index) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-semibold text-[var(--text-main)]">#{index + 1}</TableCell>
                    <TableCell>
                      <div className="font-semibold text-[var(--text-main)]">{user.name}</div>
                      <div className="mt-1 text-sm text-[var(--text-muted)]">
                        {user.username ? `@${user.username}` : 'Guild member'}
                      </div>
                    </TableCell>
                    <TableCell>{formatDuration(user.voice_time)}</TableCell>
                    <TableCell>{user.messages}</TableCell>
                    <TableCell className="font-semibold text-[var(--text-main)]">{user.score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
              No activity captured yet.
            </div>
          )}
        </CardContent>
      </Card>

      <SearchPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Choose AFK Channels"
        description="Selected channels will not contribute any voice activity."
        items={voiceChannels.map((item) => ({ id: item.id, label: item.name, description: `Voice channel ${item.id}` }))}
        selectedIds={afkChannelIds}
        onConfirm={saveAfkChannels}
        multiple
        placeholder="Search voice channels"
      />
    </div>
  );
}
