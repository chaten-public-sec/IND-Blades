import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Shield, Users2, Workflow, ArrowRightLeft, AlertCircle, Trash2 } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

function emptyBinding() {
  return { role_a: '', role_b: '' };
}

function MetricCard({ icon: Icon, label, value, note }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--primary-soft)] text-[var(--primary)]">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--text-muted)]">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--text-main)]">{value}</p>
          {note ? <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{note}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}

function InlineError({ message }) {
  if (!message) return null;
  return (
    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-rose-400">
      <AlertCircle className="h-4 w-4" />
      <span>{message}</span>
    </div>
  );
}

export default function AutoRolePage() {
  const dashboard = useDashboardContext();
  const [joinRoleId, setJoinRoleId] = useState('');
  const [famRoleId, setFamRoleId] = useState('');
  const [bindings, setBindings] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pickerState, setPickerState] = useState(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    setJoinRoleId(dashboard.autorole.join_role_id || '');
    setBindings(Array.isArray(dashboard.autorole.bindings) ? dashboard.autorole.bindings : []);
    setFamRoleId(dashboard.management.settings?.fam_discord_role_id || '');
  }, [dashboard.autorole, dashboard.management.settings]);

  const roleMap = useMemo(() => {
    const map = new Map();
    dashboard.roles.forEach((item) => map.set(String(item.id), item.name));
    return map;
  }, [dashboard.roles]);

  const validation = useMemo(() => {
    const pairSet = new Set();
    const rowErrors = bindings.map((binding) => {
      if (!binding.role_a && !binding.role_b) return '';
      if (!binding.role_a || !binding.role_b) return 'Choose both roles for this binding.';
      if (String(binding.role_a) === String(binding.role_b)) return 'Trigger and provisioned roles must be different.';

      const pairKey = `${binding.role_a}:${binding.role_b}`;
      if (pairSet.has(pairKey)) return 'This binding already exists.';
      pairSet.add(pairKey);
      return '';
    });

    return {
      hasError: rowErrors.some(Boolean),
      rowErrors,
    };
  }, [bindings]);

  const activeBindingCount = bindings.filter((item) => item.role_a && item.role_b).length;

  const openPicker = (mode, index = null) => {
    setPickerState({ mode, index });
  };

  const roleName = (roleId, fallback = 'Choose role') => roleMap.get(String(roleId || '')) || fallback;

  const handlePickerConfirm = (ids) => {
    const selectedId = ids[0] || '';
    if (!pickerState) return;

    if (pickerState.mode === 'fam') {
      setFamRoleId(selectedId);
    } else if (pickerState.mode === 'join') {
      setJoinRoleId(selectedId);
    } else if (typeof pickerState.index === 'number') {
      setBindings((current) =>
        current.map((item, index) =>
          index === pickerState.index
            ? {
                ...item,
                [pickerState.mode === 'binding-trigger' ? 'role_a' : 'role_b']: selectedId,
              }
            : item
        )
      );
    }
  };

  const saveEverything = async () => {
    setSubmitAttempted(true);
    if (validation.hasError) {
      dashboard.showToast('error', 'Fix the highlighted role bindings before saving.', 'autorole-validation');
      return;
    }

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
      setSubmitAttempted(false);
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
        title="Role Automation"
        description="Control automatic Fam Member access, assign the join role, and map role-to-role automation without leaving the dashboard."
        actions={(
          <Button loading={saving} onClick={saveEverything}>
            <Save className="h-4 w-4" />
            Save Settings
          </Button>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard
          icon={Users2}
          label="Fam Role"
          value={famRoleId ? 'Configured' : 'Unset'}
          note={roleName(famRoleId, 'No Fam Member role selected yet.')}
        />
        <MetricCard
          icon={Shield}
          label="Join Role"
          value={joinRoleId ? 'Configured' : 'Unset'}
          note={roleName(joinRoleId, 'No join role selected yet.')}
        />
        <MetricCard
          icon={Workflow}
          label="Active Bindings"
          value={activeBindingCount}
          note="Role-to-role automation rules currently ready to apply."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]">
        <Card className="surface-highlight">
          <CardHeader>
            <CardTitle>Access Roles</CardTitle>
            <CardDescription>Fam Member access is granted automatically when a guild member has the configured Discord role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-soft rounded-[24px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">Fam Member Role</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    Members with this Discord role are treated as Fam Members inside the dashboard.
                  </p>
                </div>
                <Badge variant={famRoleId ? 'success' : 'neutral'}>{famRoleId ? 'Set' : 'Unset'}</Badge>
              </div>
              <Button variant="secondary" className="mt-4 w-full justify-between" onClick={() => openPicker('fam')}>
                <span className="truncate">{roleName(famRoleId, 'Choose Fam Member role')}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Select</span>
              </Button>
            </div>

            <div className="surface-soft rounded-[24px] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">Join Role</p>
                  <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                    Optional role the bot can apply during the initial join flow.
                  </p>
                </div>
                <Badge variant={joinRoleId ? 'success' : 'neutral'}>{joinRoleId ? 'Set' : 'Unset'}</Badge>
              </div>
              <Button variant="secondary" className="mt-4 w-full justify-between" onClick={() => openPicker('join')}>
                <span className="truncate">{roleName(joinRoleId, 'Choose join role')}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Select</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Auto Role Bindings</CardTitle>
            <CardDescription>Map one role to another. When the trigger role is present, the provisioned role can be applied automatically by the bot.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bindings.length ? (
              bindings.map((binding, index) => {
                const error = validation.rowErrors[index];
                return (
                  <div key={`${binding.role_a}-${binding.role_b}-${index}`} className="surface-soft rounded-[24px] p-4">
                    <div className="grid gap-3 lg:grid-cols-[1fr_42px_1fr_auto] lg:items-center">
                      <Button
                        variant="secondary"
                        className="justify-between"
                        onClick={() => openPicker('binding-trigger', index)}
                      >
                        <span className="truncate">{roleName(binding.role_a, 'Choose trigger role')}</span>
                        <span className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Pick</span>
                      </Button>

                      <div className="flex h-11 items-center justify-center rounded-[16px] border border-[var(--border)] bg-[rgba(var(--bg-card-rgb),0.32)] text-[var(--text-muted)]">
                        <ArrowRightLeft className="h-4 w-4" />
                      </div>

                      <Button
                        variant="secondary"
                        className="justify-between"
                        onClick={() => openPicker('binding-provision', index)}
                      >
                        <span className="truncate">{roleName(binding.role_b, 'Choose provisioned role')}</span>
                        <span className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Pick</span>
                      </Button>

                      <Button
                        variant="ghost"
                        className="text-rose-300 hover:text-rose-200"
                        onClick={() => setBindings((current) => current.filter((_, currentIndex) => currentIndex !== index))}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                    {submitAttempted ? <InlineError message={error} /> : null}
                  </div>
                );
              })
            ) : (
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
        open={Boolean(pickerState)}
        onOpenChange={(open) => {
          if (!open) setPickerState(null);
        }}
        title={
          pickerState?.mode === 'fam'
            ? 'Choose Fam Member Role'
            : pickerState?.mode === 'join'
              ? 'Choose Join Role'
              : pickerState?.mode === 'binding-trigger'
                ? 'Choose Trigger Role'
                : 'Choose Provisioned Role'
        }
        description="Search Discord roles and choose the one you want to use."
        items={dashboard.roles.map((item) => ({ id: item.id, label: item.name, description: `Role ID ${item.id}` }))}
        selectedIds={
          pickerState?.mode === 'fam'
            ? (famRoleId ? [famRoleId] : [])
            : pickerState?.mode === 'join'
              ? (joinRoleId ? [joinRoleId] : [])
              : typeof pickerState?.index === 'number'
                ? [
                    pickerState.mode === 'binding-trigger'
                      ? (bindings[pickerState.index]?.role_a || '')
                      : (bindings[pickerState.index]?.role_b || ''),
                  ].filter(Boolean)
                : []
        }
        onConfirm={handlePickerConfirm}
        placeholder="Search roles"
      />
    </div>
  );
}
