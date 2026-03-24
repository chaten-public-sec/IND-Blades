import { useEffect, useState } from 'react';
import { Pencil, Plus, Power, Save, Trash2 } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/access';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

function emptyCategory() {
  return {
    name: '',
    enabled: true,
    logs: [],
    channel_id: null,
  };
}

export default function DiscordLogsPage() {
  const dashboard = useDashboardContext();
  const [categories, setCategories] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(-1);
  const [draft, setDraft] = useState(emptyCategory());
  const [saving, setSaving] = useState(false);
  const canManageDiscordLogs = hasPermission(dashboard.viewer, 'manage_discord_logs');

  useEffect(() => {
    setCategories(Array.isArray(dashboard.discordLogs.categories) ? dashboard.discordLogs.categories : []);
  }, [dashboard.discordLogs]);

  const persistCategories = async (nextCategories = categories, enabled = dashboard.discordLogs.enabled) => {
    setSaving(true);
    try {
      await api.post('/api/discord-logs', {
        enabled,
        categories: nextCategories,
      });
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'Log categories saved.', 'discord-log-settings');
    } catch (error) {
      dashboard.handleError(error, 'Unable to save the log categories.');
    } finally {
      setSaving(false);
      setPickerOpen(false);
    }
  };

  const channelName = (channelId) =>
    dashboard.channels.find((item) => String(item.id) === String(channelId || ''))?.name || 'Choose channel';

  const openCreate = () => {
    setEditingIndex(-1);
    setDraft(emptyCategory());
    setDialogOpen(true);
  };

  const openEdit = (category, index) => {
    setEditingIndex(index);
    setDraft({
      name: category.name || '',
      enabled: category.enabled !== false,
      logs: Array.isArray(category.logs) ? category.logs : [],
      channel_id: category.channel_id || null,
    });
    setDialogOpen(true);
  };

  const saveDraft = async () => {
    const nextCategories = editingIndex >= 0
      ? categories.map((item, index) => index === editingIndex ? draft : item)
      : [...categories, draft];

    setCategories(nextCategories);
    setDialogOpen(false);
    await persistCategories(nextCategories);
  };

  const removeCategory = async (indexToRemove) => {
    const nextCategories = categories.filter((_, index) => index !== indexToRemove);
    setCategories(nextCategories);
    await persistCategories(nextCategories);
  };

  const toggleCategory = async (indexToToggle) => {
    const nextCategories = categories.map((item, index) => index === indexToToggle ? { ...item, enabled: !item.enabled } : item);
    setCategories(nextCategories);
    await persistCategories(nextCategories);
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Logs"
        title="Logs"
        description="Create clean log categories, choose what each one listens to, and route everything to the right channel."
        actions={canManageDiscordLogs ? (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create Log Category
          </Button>
        ) : null}
      />

      <Card>
        <CardHeader>
          <CardTitle>Master Toggle</CardTitle>
          <CardDescription>Turn Discord log category delivery on or off without losing the saved setup.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <Badge variant={dashboard.discordLogs.enabled ? 'success' : 'danger'}>
            {dashboard.discordLogs.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          {canManageDiscordLogs ? (
            <Button variant="secondary" loading={saving} onClick={() => persistCategories(categories, !dashboard.discordLogs.enabled)}>
              <Power className="h-4 w-4" />
              {dashboard.discordLogs.enabled ? 'Disable Delivery' : 'Enable Delivery'}
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        {categories.length ? categories.map((category, index) => (
          <Card key={`${category.name}-${index}`} className={category.enabled ? 'surface-highlight' : ''}>
            <CardContent className="space-y-5 p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-[var(--text-main)]">{category.name || `Category ${index + 1}`}</h3>
                    <Badge variant={category.enabled ? 'success' : 'neutral'}>
                      {category.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">Channel: {channelName(category.channel_id)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Selected Logs</p>
                <div className="flex flex-wrap gap-2">
                  {(category.logs || []).length ? category.logs.map((logKey) => (
                    <Badge key={logKey} variant="neutral">{logKey}</Badge>
                  )) : (
                    <span className="text-sm text-[var(--text-muted)]">No log keys selected.</span>
                  )}
                </div>
              </div>

              {canManageDiscordLogs ? (
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={() => openEdit(category, index)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="secondary" onClick={() => toggleCategory(index)}>
                    <Power className="h-4 w-4" />
                    {category.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="danger" onClick={() => removeCategory(index)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )) : (
          <Card className="xl:col-span-2">
            <CardContent className="surface-soft m-6 rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
              No log categories have been created yet.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(96vw,760px)]">
          <DialogHeader>
            <DialogTitle>{editingIndex >= 0 ? 'Edit Log Category' : 'Create Log Category'}</DialogTitle>
            <DialogDescription>Choose a name, add the log keys you want, and route this category to a channel.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Category Name</label>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="surface-soft h-12 w-full rounded-[22px] px-4 text-sm"
                  placeholder="Moderation Actions"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Selected Channel</label>
                <Button variant="secondary" className="w-full justify-between" onClick={() => setPickerOpen(true)}>
                  {channelName(draft.channel_id)}
                  <span className="text-xs text-[var(--text-muted)]">Choose channel</span>
                </Button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Log Keys</label>
                <textarea
                  value={(draft.logs || []).join('\n')}
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    logs: event.target.value.split(/\r?\n|,/).map((value) => value.trim()).filter(Boolean),
                  }))}
                  className="surface-soft min-h-32 rounded-[22px] px-4 py-3 text-sm"
                  placeholder="One log key per line, for example message_delete"
                />
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setDraft((current) => ({ ...current, enabled: !current.enabled }))}
                >
                  <Power className="h-4 w-4" />
                  {draft.enabled ? 'Set Disabled' : 'Set Enabled'}
                </Button>
                <Badge variant={draft.enabled ? 'success' : 'neutral'}>
                  {draft.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={saveDraft}>
              <Save className="h-4 w-4" />
              Save Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SearchPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="Choose Channel"
        description="Search the Discord channels available for this log category."
        items={dashboard.channels.map((item) => ({ id: item.id, label: item.name, description: `Channel ID ${item.id}` }))}
        selectedIds={draft.channel_id ? [String(draft.channel_id)] : []}
        onConfirm={(ids) => setDraft((current) => ({ ...current, channel_id: ids[0] || null }))}
        placeholder="Search channels"
      />
    </div>
  );
}
