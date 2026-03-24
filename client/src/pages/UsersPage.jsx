import { useMemo, useState } from 'react';
import { Search, ShieldPlus, UserCog } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { getRoleLabel, hasPermission } from '../lib/access';
import { formatDuration } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import RoleBadge from '../components/RoleBadge';
import ProfileAvatar from '../components/ProfileAvatar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table';

function allowedAssignableRoles(viewerRole) {
  if (viewerRole === 'super_admin') return ['leader', 'deputy', 'high_command'];
  if (viewerRole === 'leader') return ['deputy', 'high_command'];
  if (viewerRole === 'deputy') return ['high_command'];
  return [];
}

function MetricCard({ label, value, note }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
        <p className="text-3xl font-semibold text-[var(--text-main)]">{value}</p>
        {note ? <p className="text-sm text-[var(--text-muted)]">{note}</p> : null}
      </CardContent>
    </Card>
  );
}

export default function UsersPage() {
  const dashboard = useDashboardContext();
  const canManageRoles = hasPermission(dashboard.viewer, 'manage_web_roles');
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const roleMap = useMemo(() => {
    const map = new Map();
    dashboard.roles.forEach((role) => map.set(String(role.id), role));
    return map;
  }, [dashboard.roles]);

  const users = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return dashboard.users;
    return dashboard.users.filter((item) =>
      `${item.name} ${item.username || ''} ${item.primary_role || ''}`.toLowerCase().includes(term)
    );
  }, [dashboard.users, query]);

  const managedRoleCount = dashboard.users.filter((user) => user.primary_role && user.primary_role !== 'fam_member').length;
  const activeStrikeCount = dashboard.users.reduce(
    (total, user) => total + (user.strikes || []).filter((item) => item.status === 'active').length,
    0
  );

  const assignRole = async (role) => {
    if (!selectedUser) return;
    try {
      await api.post('/api/management/roles/assign', {
        user_id: selectedUser.id,
        role,
      });
      dashboard.showToast('success', `${selectedUser.name} is now ${getRoleLabel(role)}.`, `assign-role-${selectedUser.id}`);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to assign that website role.');
    }
  };

  const clearRole = async (userId) => {
    try {
      await api.post('/api/management/roles/clear', { user_id: userId });
      dashboard.showToast('success', 'Managed website role removed.', `clear-role-${userId}`);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to remove that website role.');
    }
  };

  const roleOptions = allowedAssignableRoles(dashboard.viewer.primary_role).map((role) => ({
    id: role,
    label: getRoleLabel(role),
    description: `Assign ${getRoleLabel(role)} access`,
  }));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Members"
        title="Members"
        description="Browse the live roster, review activity and strikes, and assign managed website roles where your permissions allow it."
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Tracked Members" value={dashboard.users.length} note="Members currently loaded into the dashboard." />
        <MetricCard label="Managed Roles" value={managedRoleCount} note="Leader, Deputy, and High Command assignments." />
        <MetricCard label="Active Strikes" value={activeStrikeCount} note="Live active strikes across the roster." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Member Directory</CardTitle>
          <CardDescription>Search by display name, username, or website role.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="surface-soft h-12 w-full rounded-[22px] pl-11 pr-4 text-sm"
              placeholder="Search members"
            />
          </div>

          {users.length ? (
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Member</TableHeaderCell>
                  <TableHeaderCell>Roles</TableHeaderCell>
                  <TableHeaderCell>Activity</TableHeaderCell>
                  <TableHeaderCell>Strikes</TableHeaderCell>
                  {canManageRoles ? <TableHeaderCell className="text-right">Manage</TableHeaderCell> : null}
                </tr>
              </TableHead>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => dashboard.openProfileDialog?.(user)}
                        className="flex items-center gap-3 text-left transition hover:opacity-90"
                      >
                        <ProfileAvatar
                          name={user.name}
                          avatarUrl={user.avatar_url}
                          size="md"
                        />
                        <div>
                          <div className="font-semibold text-[var(--text-main)]">{user.name}</div>
                          <div className="mt-1 text-sm text-[var(--text-muted)]">
                            {user.username ? `@${user.username}` : `ID ${user.id}`}
                          </div>
                          <div className="mt-2 text-xs text-[var(--text-muted)]">
                            Click to open profile
                          </div>
                        </div>
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {user.primary_role ? <RoleBadge role={user.primary_role} /> : <span className="text-sm text-[var(--text-muted)]">No website role</span>}
                        {(user.roles || [])
                          .map((roleId) => roleMap.get(String(roleId)))
                          .filter(Boolean)
                          .slice(0, 2)
                          .map((role) => (
                            <span key={role.id} className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--text-main)]">
                              {role.name}
                            </span>
                          ))}
                        {(user.roles || []).length > 2 ? (
                          <span className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-1 text-[11px] font-semibold text-[var(--text-muted)]">
                            +{(user.roles || []).length - 2}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="text-sm font-semibold text-[var(--text-main)]">{formatDuration(user.voice_time)}</div>
                        <div className="text-sm text-[var(--text-muted)]">{user.messages} messages</div>
                      </div>
                    </TableCell>
                    <TableCell>{user.strikes?.filter((item) => item.status === 'active').length || 0}</TableCell>
                    {canManageRoles ? (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {roleOptions.length ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => {
                                setSelectedUser(user);
                                setAssignDialogOpen(true);
                              }}
                            >
                              <ShieldPlus className="h-4 w-4" />
                              Assign
                            </Button>
                          ) : null}
                          {user.primary_role && user.primary_role !== 'fam_member' ? (
                            <Button size="sm" variant="ghost" onClick={() => clearRole(user.id)}>
                              <UserCog className="h-4 w-4" />
                              Clear
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
              No members matched your search.
            </div>
          )}
        </CardContent>
      </Card>

      <SearchPickerDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        title={selectedUser ? `Assign role to ${selectedUser.name}` : 'Assign Role'}
        description="Choose the managed website role you want to assign."
        items={roleOptions}
        selectedIds={selectedUser?.primary_role ? [selectedUser.primary_role] : []}
        onConfirm={(ids) => {
          if (ids[0]) assignRole(ids[0]);
        }}
        placeholder="Search roles"
      />
    </div>
  );
}
