import { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

function emptyBinding() {
  return { role_a: '', role_b: '' };
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

export default function AutoRolePage() {
  const dashboard = useDashboardContext();
  const [joinRoleId, setJoinRoleId] = useState('');
  const [famRoleId, setFamRoleId] = useState('');
  const [bindings, setBindings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pickerMode, setPickerMode] = useState('');

  useEffect(() => {
    setJoinRoleId(dashboard.autorole.join_role_id || '');
    setBindings(Array.isArray(dashboard.autorole.bindings) ? dashboard.autorole.bindings : []);
    setFamRoleId(dashboard.management.settings?.fam_discord_role_id || '');
  }, [dashboard.autorole, dashboard.management.settings]);

  const roleName = (roleId) =>
    dashboard.roles.find((item) => String(item.id) === String(roleId || ''))?.name || 'Choose role';

  const saveEverything = async () => {
    setSaving(true);
    try {
      await Promise.all([
        api.post('/api/autorole', {
          join_role_id: joinRoleId || null,
          bindings: bindings.filter((item) => item.role_a && item.role_b),
        }),
        api.post('/api/management/settings', {
          fam_discord_role_id: famRoleId || null,
        }),
      ]);
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'Role settings saved.', 'role-settings-save');
    } catch (error) {
      dashboard.handleError(error, 'Unable to save the role settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Settings"
        title="Fam Role & Auto Role"
        description="Control who becomes a Fam Member automatically and define the role pairing rules used by the bot."
        actions={(
          <Button loading={saving} onClick={saveEverything}>
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Fam Member Role" value={famRoleId ? 'Configured' : 'Unset'} note={roleName(famRoleId)} />
        <MetricCard label="Join Role" value={joinRoleId ? 'Configured' : 'Unset'} note={roleName(joinRoleId)} />
        <MetricCard label="Auto Role Bindings" value={bindings.filter((item) => item.role_a && item.role_b).length} note="Active role-to-role mapping rules." />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="surface-highlight">
          <CardHeader>
            <CardTitle>Access Roles</CardTitle>
            <CardDescription>Fam Member access is automatic when a guild member holds the configured Discord role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="secondary" className="w-full justify-between" onClick={() => setPickerMode('fam')}>
              <span>Fam Member Role: {roleName(famRoleId)}</span>
              <span className="text-xs text-[var(--text-muted)]">Choose</span>
            </Button>
            <Button variant="secondary" className="w-full justify-between" onClick={() => setPickerMode('join')}>
              <span>Join Role: {roleName(joinRoleId)}</span>
              <span className="text-xs text-[var(--text-muted)]">Choose</span>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto Role Bindings</CardTitle>
            <CardDescription>Map trigger roles to automatic follow-up roles in a cleaner, editable list.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bindings.length ? bindings.map((binding, index) => (
              <div key={`${binding.role_a}-${binding.role_b}-${index}`} className="surface-soft grid gap-3 rounded-[24px] p-4 md:grid-cols-[1fr_1fr_auto]">
                <select
                  value={binding.role_a}
                  onChange={(event) => setBindings((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, role_a: event.target.value } : item))}
                  className="h-12 rounded-[20px] bg-transparent px-4 text-sm"
                >
                  <option value="">Trigger role</option>
                  {dashboard.roles.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <select
                  value={binding.role_b}
                  onChange={(event) => setBindings((current) => current.map((item, currentIndex) => currentIndex === index ? { ...item, role_b: event.target.value } : item))}
                  className="h-12 rounded-[20px] bg-transparent px-4 text-sm"
                >
                  <option value="">Provisioned role</option>
                  {dashboard.roles.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <Button variant="ghost" onClick={() => setBindings((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                  Remove
                </Button>
              </div>
            )) : (
              <div className="surface-soft rounded-[24px] px-5 py-10 text-center text-sm text-[var(--text-muted)]">
                No bindings created yet.
              </div>
            )}

            <Button variant="secondary" onClick={() => setBindings((current) => [...current, emptyBinding()])}>
              <Plus className="h-4 w-4" />
              Add Binding
            </Button>
          </CardContent>
        </Card>
      </div>

      <SearchPickerDialog
        open={Boolean(pickerMode)}
        onOpenChange={(open) => {
          if (!open) setPickerMode('');
        }}
        title={pickerMode === 'fam' ? 'Choose Fam Member Role' : 'Choose Join Role'}
        description="Search Discord roles and save the one you want to use."
        items={dashboard.roles.map((item) => ({ id: item.id, label: item.name, description: `Role ID ${item.id}` }))}
        selectedIds={pickerMode === 'fam'
          ? (famRoleId ? [famRoleId] : [])
          : (joinRoleId ? [joinRoleId] : [])}
        onConfirm={(ids) => {
          if (pickerMode === 'fam') {
            setFamRoleId(ids[0] || '');
          } else {
            setJoinRoleId(ids[0] || '');
          }
        }}
        placeholder="Search roles"
      />
    </div>
  );
}
