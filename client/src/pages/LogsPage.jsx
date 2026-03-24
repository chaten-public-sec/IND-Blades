import { useState } from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/access';
import { formatDate } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table';

const CHANNEL_FIELDS = [
  { key: 'moderation_channel_id', label: 'Moderation Logs' },
  { key: 'event_channel_id', label: 'Event Logs' },
  { key: 'system_channel_id', label: 'System Logs' },
];

export default function LogsPage() {
  const dashboard = useDashboardContext();
  const [activeField, setActiveField] = useState('');
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const canManageLogs = hasPermission(dashboard.viewer, 'manage_logs');

  const channelName = (channelId) =>
    dashboard.channels.find((item) => String(item.id) === String(channelId || ''))?.name || 'Choose channel';

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
        title="System Logs"
        description="Live dashboard and system actions appear here in real time. Routing can be updated without leaving the page."
        actions={canManageLogs ? (
          <Button variant="danger" loading={clearing} onClick={clearLogs}>
            <Trash2 className="h-4 w-4" />
            Clear Logs
          </Button>
        ) : null}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Realtime Feed</CardTitle>
            <CardDescription>Latest system actions, updates, and operational changes.</CardDescription>
          </CardHeader>
          <CardContent>
            {dashboard.logs.length ? (
              <Table>
                <TableHead>
                  <tr>
                    <TableHeaderCell>Time</TableHeaderCell>
                    <TableHeaderCell>Source</TableHeaderCell>
                    <TableHeaderCell>Level</TableHeaderCell>
                    <TableHeaderCell>Message</TableHeaderCell>
                  </tr>
                </TableHead>
                <TableBody>
                  {dashboard.logs.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.timestamp)}</TableCell>
                      <TableCell>{item.source}</TableCell>
                      <TableCell>
                        <Badge variant={item.level === 'warning' ? 'warning' : item.level === 'error' ? 'danger' : 'default'}>
                          {item.level}
                        </Badge>
                      </TableCell>
                      <TableCell>{item.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="surface-soft rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
                No system logs yet.
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery Settings</CardTitle>
            <CardDescription>Choose where moderation, event, and system log messages should be routed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="surface-soft flex items-center justify-between rounded-[24px] p-5">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">Log Delivery</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">Master switch for server-side log routing.</p>
              </div>
              <Badge variant={dashboard.logSettings.enabled ? 'success' : 'danger'}>
                {dashboard.logSettings.enabled ? 'Enabled' : 'Disabled'}
              </Badge>
            </div>

            {canManageLogs ? (
              <Button variant="secondary" loading={saving} onClick={() => saveLogSettings({ enabled: !dashboard.logSettings.enabled })}>
                <RefreshCw className="h-4 w-4" />
                {dashboard.logSettings.enabled ? 'Disable Delivery' : 'Enable Delivery'}
              </Button>
            ) : null}

            {CHANNEL_FIELDS.map((field) => (
              <Button
                key={field.key}
                variant="secondary"
                className="w-full justify-between"
                onClick={() => setActiveField(field.key)}
                disabled={!canManageLogs}
              >
                <span className="truncate">{field.label}: {channelName(dashboard.logSettings[field.key])}</span>
                <span className="text-xs text-[var(--text-muted)]">Change</span>
              </Button>
            ))}
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
