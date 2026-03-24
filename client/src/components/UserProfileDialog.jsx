import { Activity, CalendarDays, Clock3, IdCard, MessageSquareText, ShieldAlert, Trophy, UserCircle2 } from 'lucide-react';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import RoleBadge from './RoleBadge';
import ProfileAvatar from './ProfileAvatar';
import { formatDate, formatDuration } from '../lib/format';

function roleColorStyle(color) {
  const value = Number(color || 0);
  if (!value) {
    return {
      backgroundColor: 'var(--bg-soft)',
      borderColor: 'var(--border)',
      color: 'var(--text-main)',
    };
  }

  const hex = `#${value.toString(16).padStart(6, '0')}`;
  return {
    backgroundColor: `${hex}18`,
    borderColor: `${hex}33`,
    color: hex,
  };
}

function ActivityCard({ icon: Icon, label, value, note }) {
  return (
    <div className="surface-soft rounded-[22px] p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{value}</p>
      {note ? <p className="mt-2 text-sm text-[var(--text-muted)]">{note}</p> : null}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-24 w-24 rounded-[28px]" />
        <div className="space-y-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32 rounded-[24px]" />
        <Skeleton className="h-32 rounded-[24px]" />
        <Skeleton className="h-32 rounded-[24px]" />
      </div>
      <Skeleton className="h-48 rounded-[28px]" />
      <Skeleton className="h-40 rounded-[28px]" />
    </div>
  );
}

export default function UserProfileDialog({
  open,
  onOpenChange,
  user,
  roles = [],
  roster = [],
  leaderboard = [],
  loading = false,
  title = 'User Profile',
  description = 'Profile summary, activity, strikes, and roles.',
}) {
  const rank = user ? leaderboard.findIndex((item) => String(item.id) === String(user.id)) + 1 : 0;
  const rosterMap = new Map(roster.map((member) => [String(member.id), member.name]));
  const discordRoles = user
    ? roles.filter((role) => Array.isArray(user.roles) && user.roles.map(String).includes(String(role.id)))
    : [];
  const websiteRoles = Array.isArray(user?.website_roles) ? user.website_roles : (user?.primary_role ? [user.primary_role] : []);
  const strikeHistory = Array.isArray(user?.strikes) ? user.strikes : [];
  const joinedAt = user?.joined_at || user?.guild_joined_at || null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,860px)]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          {loading || !user ? (
            <ProfileSkeleton />
          ) : (
            <div className="space-y-6">
              <Card className="surface-highlight">
                <CardContent className="p-6 sm:p-7">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                      <ProfileAvatar
                        name={user.name || user.display_name || user.username}
                        avatarUrl={user.avatar_url}
                        size="xl"
                      />
                      <div className="space-y-2">
                        <h2 className="text-3xl font-semibold text-[var(--text-main)]">
                          {user.name || user.display_name || user.username}
                        </h2>
                        <p className="text-sm text-[var(--text-muted)]">
                          {user.username ? `@${user.username}` : `ID ${user.id}`}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {websiteRoles.length ? websiteRoles.map((role) => (
                            <RoleBadge key={role} role={role} />
                          )) : (
                            <Badge variant="neutral">No website role</Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:min-w-[190px]">
                      <div className="surface-soft rounded-[20px] px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">User ID</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">{user.id}</p>
                      </div>
                      <div className="surface-soft rounded-[20px] px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Joined</p>
                        <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                          {formatDate(joinedAt, 'Not available')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-[var(--primary)]" />
                    Activity
                  </CardTitle>
                  <CardDescription>Current weekly snapshot for this member.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <ActivityCard
                    icon={MessageSquareText}
                    label="Messages"
                    value={user.messages || 0}
                    note="Messages this week"
                  />
                  <ActivityCard
                    icon={Clock3}
                    label="Voice Time"
                    value={formatDuration(user.voice_time || 0)}
                    note="Tracked voice activity"
                  />
                  <ActivityCard
                    icon={Trophy}
                    label="Rank"
                    value={rank > 0 ? `#${rank}` : 'N/A'}
                    note="Leaderboard position"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-400" />
                    Strike History
                  </CardTitle>
                  <CardDescription>Full strike timeline with status and expiry.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {strikeHistory.length ? strikeHistory.map((strike) => (
                    <div key={strike.id} className="surface-soft rounded-[24px] p-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm font-semibold text-[var(--text-main)]">{strike.reason}</p>
                        <Badge variant={strike.status === 'active' ? 'danger' : strike.status === 'revoked' ? 'neutral' : 'warning'}>
                          {strike.status}
                        </Badge>
                        <span className="ml-auto text-xs text-[var(--text-muted)]">{formatDate(strike.timestamp)}</span>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-[var(--text-muted)] md:grid-cols-2">
                        <p>Given by: {rosterMap.get(String(strike.issued_by)) || strike.issued_by || 'System'}</p>
                        <p>Expiry: {formatDate(strike.expires_at, 'Not set')}</p>
                        <p>Status: {strike.status || 'Unknown'}</p>
                        <p>Revoked by: {rosterMap.get(String(strike.revoked_by)) || strike.revoked_by || 'N/A'}</p>
                      </div>
                    </div>
                  )) : (
                    <div className="surface-soft rounded-[24px] px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                      No strike history found.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCircle2 className="h-4 w-4 text-[var(--primary)]" />
                    Roles
                  </CardTitle>
                  <CardDescription>All Discord roles currently attached to this member.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Discord Roles</p>
                    <div className="flex flex-wrap gap-2">
                      {discordRoles.length ? discordRoles.map((role) => (
                        <span
                          key={role.id}
                          className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold"
                          style={roleColorStyle(role.color)}
                        >
                          {role.name}
                        </span>
                      )) : (
                        <Badge variant="neutral">No Discord roles</Badge>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Extra Info</p>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="surface-soft rounded-[20px] p-4">
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                          <IdCard className="h-4 w-4" />
                          <span className="text-xs font-black uppercase tracking-[0.16em]">User ID</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-[var(--text-main)]">{user.id}</p>
                      </div>
                      <div className="surface-soft rounded-[20px] p-4">
                        <div className="flex items-center gap-2 text-[var(--text-muted)]">
                          <CalendarDays className="h-4 w-4" />
                          <span className="text-xs font-black uppercase tracking-[0.16em]">Join Date</span>
                        </div>
                        <p className="mt-3 text-sm font-semibold text-[var(--text-main)]">
                          {formatDate(joinedAt, 'Not available')}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
