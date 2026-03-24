import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Bell, CalendarDays, ShieldAlert, Trophy, Users2 } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { hasPermission } from '../lib/access';
import { formatDate, formatDuration, formatShortDate, initials } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import RoleBadge from '../components/RoleBadge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

function StatCard({ icon: Icon, label, value, tone = 'default', note }) {
  const toneClasses = {
    default: 'bg-[var(--primary-soft)] text-[var(--primary)]',
    success: 'bg-emerald-500/12 text-emerald-400',
    warning: 'bg-amber-500/12 text-amber-400',
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className={`flex h-11 w-11 items-center justify-center rounded-[16px] ${toneClasses[tone] || toneClasses.default}`}>
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

export default function OverviewPage() {
  const dashboard = useDashboardContext();
  const topLeaders = dashboard.leaderboard.slice(0, 5);
  const latestEvents = dashboard.events.slice(0, 3);
  const recentNotifications = dashboard.notificationCenter.slice(0, 3);
  const trackedMembers = dashboard.roster.length;
  const activeStrikeCount = dashboard.users.reduce(
    (total, user) => total + (user.strikes || []).filter((item) => item.status === 'active').length,
    0
  );
  const weeklyScore = Math.round((Number(dashboard.myProfile?.voice_time || 0) / 60) * 2 + Number(dashboard.myProfile?.messages || 0));
  const myRank = Math.max(dashboard.leaderboard.findIndex((item) => String(item.id) === String(dashboard.viewer.id)) + 1, 1);

  const quickActions = [
    { label: 'Activity', path: '/dashboard/activity', icon: Activity, show: hasPermission(dashboard.viewer, 'view_activity') },
    { label: 'Events', path: '/dashboard/events', icon: CalendarDays, show: hasPermission(dashboard.viewer, 'view_events') },
    { label: 'Strikes', path: '/dashboard/strikes', icon: ShieldAlert, show: hasPermission(dashboard.viewer, 'view_self_strikes') || hasPermission(dashboard.viewer, 'apply_strikes') || hasPermission(dashboard.viewer, 'issue_strikes') },
    { label: 'Notifications', path: '/dashboard/notifications', icon: Bell, show: hasPermission(dashboard.viewer, 'view_notifications') },
  ].filter((item) => item.show);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Overview"
        title={`Welcome back, ${dashboard.viewer.display_name}`}
        description="This dashboard stays simple for members and unlocks more controls automatically as your role increases."
        actions={(
          <>
            <RoleBadge role={dashboard.viewer.primary_role} />
            <Badge variant={dashboard.botStatus === 'connected' ? 'success' : 'danger'}>
              Bot {dashboard.botStatus === 'connected' ? 'Online' : 'Offline'}
            </Badge>
          </>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <StatCard icon={CalendarDays} label="Total Events" value={dashboard.events.length} note="Scheduled items in the current system." />
        <StatCard icon={ShieldAlert} label="Active Strikes" value={activeStrikeCount} tone="warning" note="Live active strikes across tracked members." />
        <StatCard icon={Trophy} label="Weekly Activity" value={`${weeklyScore} pts`} note={`You are ranked #${myRank} this week.`} />
        <StatCard icon={Users2} label="Members Tracked" value={trackedMembers} tone="success" note="Current guild roster loaded into the dashboard." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="surface-highlight">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-[var(--primary-soft)] text-lg font-bold text-[var(--text-main)]">
                  {initials(dashboard.viewer.display_name)}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--text-muted)]">My Profile</p>
                  <h2 className="text-2xl font-semibold text-[var(--text-main)]">{dashboard.myProfile?.name || dashboard.viewer.display_name}</h2>
                  <p className="text-sm text-[var(--text-muted)]">@{dashboard.viewer.username}</p>
                  <RoleBadge role={dashboard.viewer.primary_role} />
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Guild Joined</p>
                <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                  {formatShortDate(dashboard.viewer.guild_joined_at, 'Unknown')}
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="surface-soft rounded-[24px] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Voice Time</p>
                <p className="mt-3 text-2xl font-semibold text-[var(--text-main)]">{formatDuration(dashboard.myProfile?.voice_time || 0)}</p>
              </div>
              <div className="surface-soft rounded-[24px] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Messages</p>
                <p className="mt-3 text-2xl font-semibold text-[var(--text-main)]">{dashboard.myProfile?.messages || 0}</p>
              </div>
              <div className="surface-soft rounded-[24px] p-5">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Unread Alerts</p>
                <p className="mt-3 text-2xl font-semibold text-[var(--text-main)]">{dashboard.unreadNotifications}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Access</CardTitle>
            <CardDescription>Open the most useful areas for your current role.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {quickActions.map((item) => (
              <Button key={item.path} asChild variant="secondary" className="justify-between">
                <Link to={item.path}>
                  <span className="flex items-center gap-2">
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
            <CardDescription>Top weekly contributors from messages and voice activity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {topLeaders.length ? topLeaders.map((item, index) => (
              <div key={item.id} className="surface-soft flex items-center justify-between rounded-[24px] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">#{index + 1} {item.name}</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    {item.messages} messages / {formatDuration(item.voice_time)}
                  </p>
                </div>
                <p className="text-lg font-semibold text-[var(--text-main)]">{item.score} pts</p>
              </div>
            )) : (
              <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
                No activity has been captured yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Notifications</CardTitle>
            <CardDescription>Your newest updates across strikes, reviews, and management actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNotifications.length ? recentNotifications.map((item) => (
              <div key={item.id} className="surface-soft rounded-[24px] p-4">
                <div className="flex items-center gap-3">
                  <Badge variant={item.read_at ? 'neutral' : 'default'}>
                    {item.read_at ? 'Read' : 'Unread'}
                  </Badge>
                  <p className="text-sm font-semibold text-[var(--text-main)]">{item.title}</p>
                  <span className="ml-auto text-xs text-[var(--text-muted)]">{formatDate(item.created_at)}</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{item.message}</p>
              </div>
            )) : (
              <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
                No notifications yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {hasPermission(dashboard.viewer, 'view_events') ? (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Events</CardTitle>
            <CardDescription>Current events pulled from the live reminder system.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {latestEvents.length ? latestEvents.map((event) => (
              <div key={event.id} className="surface-soft rounded-[24px] p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold text-[var(--text-main)]">{event.desc}</p>
                    <p className="mt-2 text-sm text-[var(--text-muted)]">
                      {event.event_date ? formatDate(event.event_date) : (event.time || 'Time not set')}
                    </p>
                  </div>
                  <Badge variant={event.enabled ? 'success' : 'danger'}>
                    {event.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>
              </div>
            )) : (
              <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)] md:col-span-3">
                No events available yet.
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
