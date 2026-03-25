import { useMemo, useState } from 'react';
import { FileClock, RefreshCw, Trash2, TriangleAlert, RadioTower, FolderKanban } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/access';
import { formatDate } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';

const CHANNEL_FIELDS = [
  { key: 'moderation_channel_id', label: 'Moderation Logs', description: 'Kick, ban, strike, and review actions.', icon: TriangleAlert },
  { key: 'event_channel_id', label: 'Event Logs', description: 'Event scheduling updates and attendance changes.', icon: FolderKanban },
  { key: 'system_channel_id', label: 'System Logs', description: 'Internal dashboard and bot automation messages.', icon: RadioTower },
];

function MetricCard({ icon: Icon, label, value, note, tone = 'default' }) {
  const toneClass = {
    default: 'bg-[var(--primary-soft)] text-[var(--primary)]',
    warning: 'bg-amber-500/12 text-amber-400',
    success: 'bg-emerald-500/12 text-emerald-400',
  };

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className={`flex h-11 w-11 items-center justify-center rounded-[16px] ${toneClass[tone] || toneClass.default}`}>
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

function LogRouteCard({ field, channelName, channelId, enabled, onSelect, disabled }) {
  const Icon = field.icon;
  return (
    <div className="surface-soft rounded-[24px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--primary-soft)] text-[var(--primary)]">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-main)]">{field.label}</p>
            <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{field.description}</p>
          </div>
        </div>
        <Badge variant={enabled ? 'success' : 'neutral'}>{enabled ? 'Configured' : 'Unset'}</Badge>
      </div>

      <div className="mt-4 rounded-[20px] border border-[var(--border)] bg-[rgba(var(--bg-card-rgb),0.36)] px-4 py-3">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Destination</p>
        <p className="mt-2 truncate text-sm font-semibold text-[var(--text-main)]">{channelName}</p>
        {channelId ? <p className="mt-1 truncate text-xs text-[var(--text-muted)]">Channel ID {channelId}</p> : null}
      </div>

      <Button variant="secondary" className="mt-4 w-full justify-between" onClick={onSelect} disabled={disabled}>
        <span>Choose Channel</span>
        <span className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Edit</span>
      </Button>
    </div>
  );
}

export default function LogsPage() {
  const dashboard = useDashboardContext();
  const [activeField, setActiveField] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const canManageLogs = hasPermission(dashboard.viewer, 'manage_logs');

  const configuredRoutes = useMemo(
    () => CHANNEL_FIELDS.filter((field) => dashboard.logSettings[field.key]).length,
    [dashboard.logSettings]
  );

  const lastLogTimestamp = dashboard.logs[0]?.timestamp || null;

  const channelName = (channelId) =>
    dashboard.channels.find((item) => String(item.id) === String(channelId || ''))?.name || 'Not selected';

  const saveLogSettings = async (patch) => {
    setSaving(true);
    try {
      await api.post('/api/log-settings', {
        ...dashboard.logSettings,
        ...patch,
      });
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'Log settings saved.', 'log-settings-save');
    } catch (error) {
      dashboard.handleError(error, 'Unable to update the log settings.');
    } finally {
      setSaving(false);
      setActiveField('');
    }
  };

  const clearLogs = async () => {
    setClearing(true);
    try {
      await api.post('/api/logs/clear');
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'System logs cleared.', 'system-logs-clear');
    } catch (error) {
      dashboard.handleError(error, 'Unable to clear the system logs.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="System Logs"
        title="System Log Center"
        description="Track operational changes, choose delivery channels, and clear the live feed without leaving the dashboard."
        actions={(
          <>
            {canManageLogs ? (
              <Button variant="secondary" loading={saving} onClick={() => saveLogSettings({ enabled: !dashboard.logSettings.enabled })}>
                <RefreshCw className="h-4 w-4" />
                {dashboard.logSettings.enabled ? 'Disable Delivery' : 'Enable Delivery'}
              </Button>
            ) : null}
            {canManageLogs ? (
              <Button variant="danger" loading={clearing} onClick={clearLogs}>
                <Trash2 className="h-4 w-4" />
                Clear Logs
              </Button>
            ) : null}
          </>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-4">
        <MetricCard
          icon={FileClock}
          label="Log Entries"
          value={dashboard.logs.length}
          note="Current entries available in the live feed."
        />
        <MetricCard
          icon={RadioTower}
          label="Delivery"
          value={dashboard.logSettings.enabled ? 'On' : 'Off'}
          note="Master switch for server-side log routing."
          tone={dashboard.logSettings.enabled ? 'success' : 'warning'}
        />
        <MetricCard
          icon={FolderKanban}
          label="Routes Set"
          value={configuredRoutes}
          note="Moderation, event, and system destinations currently configured."
        />
        <MetricCard
          icon={TriangleAlert}
          label="Last Update"
          value={lastLogTimestamp ? formatDate(lastLogTimestamp) : 'None'}
          note="Most recent system entry in the feed."
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="surface-highlight">
          <CardHeader>
            <CardTitle>Delivery Settings</CardTitle>
            <CardDescription>Route each log stream to the right Discord channel. Changes are applied without leaving this page.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-soft flex items-center justify-between rounded-[24px] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">Delivery Status</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Global switch for all routed dashboard log messages.</p>
              </div>
              <Badge variant={dashboard.logSettings.enabled ? 'success' : 'danger'}>
                {dashboard.logSettings.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            <div className="grid gap-4">
              {CHANNEL_FIELDS.map((field) => (
                <LogRouteCard
                  key={field.key}
                  field={field}
                  channelName={channelName(dashboard.logSettings[field.key])}
                  channelId={dashboard.logSettings[field.key]}
                  enabled={Boolean(dashboard.logSettings[field.key])}
                  onSelect={() => setActiveField(field.key)}
                  disabled={!canManageLogs}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Realtime Feed</CardTitle>
            <CardDescription>Latest system actions, dashboard updates, and automation messages.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {dashboard.logs.length ? (
              dashboard.logs.map((item) => {
                const tone = item.level === 'warning' ? 'warning' : item.level === 'error' ? 'danger' : 'default';
                return (
                  <div key={item.id} className="surface-soft rounded-[24px] p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant={tone}>{item.level}</Badge>
                      <p className="text-sm font-semibold text-[var(--text-main)]">{item.source}</p>
                      <span className="ml-auto text-xs text-[var(--text-muted)]">{formatDate(item.timestamp)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{item.message}</p>
                  </div>
                );
              })
            ) : (
              <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
                No system logs yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <SearchPickerDialog
        open={Boolean(activeField)}
        onOpenChange={(open) => {
          if (!open) setActiveField('');
        }}
        title="Choose Log Channel"
        description="Search channels and route this log stream where you want it."
        items={dashboard.channels.map((item) => ({ id: item.id, label: item.name, description: `Channel ID ${item.id}` }))}
        selectedIds={activeField && dashboard.logSettings[activeField] ? [String(dashboard.logSettings[activeField])] : []}
        onConfirm={(ids) => {
          if (activeField) {
            saveLogSettings({ [activeField]: ids[0] || null });
          }
        }}
        placeholder="Search channels"
      />
    </div>
  );
}
