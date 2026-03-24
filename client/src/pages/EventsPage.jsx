import { useMemo, useState } from 'react';
import { CalendarPlus2, Eye, Pencil, Power, Trash2, Users } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/access';
import { formatDate } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

const EMPTY_FORM = {
  id: '',
  name: '',
  time: '18:00',
  daily: false,
  mode: 'server',
  targetType: 'channel',
  targetId: '',
  mentionRoleId: '',
};

function targetOptions({ channels, roles, users, targetType }) {
  if (targetType === 'channel') {
    return channels.map((item) => ({ id: item.id, label: item.name, description: `Channel ID ${item.id}` }));
  }
  if (targetType === 'role') {
    return roles.map((item) => ({ id: item.id, label: item.name, description: `Role ID ${item.id}` }));
  }
  return users.map((item) => ({ id: item.id, label: item.name, description: item.username ? `@${item.username}` : `User ID ${item.id}` }));
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

export default function EventsPage() {
  const dashboard = useDashboardContext();
  const canCreate = hasPermission(dashboard.viewer, 'create_events');
  const canEdit = hasPermission(dashboard.viewer, 'edit_events');
  const canToggle = hasPermission(dashboard.viewer, 'toggle_events');
  const canDelete = hasPermission(dashboard.viewer, 'delete_events');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [targetPickerOpen, setTargetPickerOpen] = useState(false);
  const [rolePickerOpen, setRolePickerOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState(null);
  const [reasonOpenId, setReasonOpenId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const targetLabelMap = useMemo(() => {
    const map = new Map();
    dashboard.channels.forEach((item) => map.set(item.id, item.name));
    dashboard.roles.forEach((item) => map.set(item.id, item.name));
    dashboard.users.forEach((item) => map.set(item.id, item.name));
    return map;
  }, [dashboard.channels, dashboard.roles, dashboard.users]);

  const userLabelMap = useMemo(() => {
    const map = new Map();
    dashboard.users.forEach((item) => map.set(String(item.id), item.name));
    return map;
  }, [dashboard.users]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (event) => {
    setForm({
      id: event.id,
      name: event.desc,
      time: event.time || '18:00',
      daily: Boolean(event.daily),
      mode: event.delivery_mode || 'server',
      targetType: event.target_type || 'channel',
      targetId: event.target_id || '',
      mentionRoleId: event.mention_role_id || '',
    });
    setDialogOpen(true);
  };

  const saveEvent = async () => {
    setSaving(true);
    try {
      const payload = {
        id: form.id || undefined,
        name: form.name,
        time: form.time,
        daily: form.daily,
        delivery_mode: form.mode,
        target_type: form.targetType,
        target_id: form.targetId,
        mention_role_id: form.mentionRoleId || null,
      };

      if (form.id) {
        await api.post('/api/events/update', payload);
        dashboard.showToast('success', 'Event updated successfully.', `event-update-${form.id}`);
      } else {
        await api.post('/api/events/create', payload);
        dashboard.showToast('success', 'Event created successfully.', 'event-create');
      }

      setDialogOpen(false);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to save the event.');
    } finally {
      setSaving(false);
    }
  };

  const toggleEvent = async (event) => {
    try {
      await api.post('/api/events/toggle', { id: event.id, enabled: !event.enabled });
      dashboard.showToast('success', event.enabled ? 'Event disabled.' : 'Event enabled.', `event-toggle-${event.id}`);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to change that event right now.');
    }
  };

  const deleteEvent = async (event) => {
    try {
      await api.post('/api/events/delete', { id: event.id });
      dashboard.showToast('success', 'Event deleted successfully.', `event-delete-${event.id}`);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Unable to delete that event.');
    }
  };

  const activeEvents = dashboard.events.filter((item) => item.enabled).length;
  const disabledEvents = dashboard.events.length - activeEvents;
  const currentTargetLabel = targetLabelMap.get(form.targetId) || 'Choose target';
  const currentMentionRoleLabel = targetLabelMap.get(form.mentionRoleId) || 'Choose role';

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Events"
        title="Events"
        description="Create, review, and manage upcoming event reminders with a cleaner card-first workflow."
        actions={canCreate ? (
          <Button onClick={openCreate}>
            <CalendarPlus2 className="h-4 w-4" />
            Create Event
          </Button>
        ) : null}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Total Events" value={dashboard.events.length} note="All event records currently in the reminder system." />
        <MetricCard label="Active Events" value={activeEvents} note="Enabled events still running right now." />
        <MetricCard label="Disabled Events" value={disabledEvents} note="Temporarily paused events waiting to be re-enabled." />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {dashboard.events.length ? dashboard.events.map((event) => (
          <Card key={event.id} className={event.enabled ? 'surface-highlight' : ''}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-xl font-semibold text-[var(--text-main)]">{event.desc}</h3>
                    <Badge variant={event.enabled ? 'success' : 'neutral'}>
                      {event.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  <p className="text-sm text-[var(--text-muted)]">
                    {event.event_date ? formatDate(event.event_date) : (event.time || 'Time not set')}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {event.daily ? 'Daily event' : 'One-time event'} / {event.delivery_mode || 'server'} / {targetLabelMap.get(event.target_id) || 'No target'}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--primary-soft)] text-[var(--primary)]">
                  <Users className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Attending</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{event.attending?.length || 0}</p>
                </div>
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Responses</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{event.not_attending?.length || 0}</p>
                </div>
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Last Trigger</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {formatDate(event.last_reminded_date || event.last_vote_date || event.event_date, 'Not triggered')}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button variant="secondary" onClick={() => setDetailsEvent(event)}>
                  <Eye className="h-4 w-4" />
                  Details
                </Button>
                {canEdit ? (
                  <Button variant="secondary" onClick={() => openEdit(event)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                ) : null}
                {canToggle ? (
                  <Button variant="secondary" onClick={() => toggleEvent(event)}>
                    <Power className="h-4 w-4" />
                    {event.enabled ? 'Disable' : 'Enable'}
                  </Button>
                ) : null}
                {canDelete ? (
                  <Button variant="danger" onClick={() => deleteEvent(event)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        )) : (
          <Card className="xl:col-span-2">
            <CardContent className="surface-soft m-6 rounded-[24px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
              No events have been created yet.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(96vw,760px)]">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Event' : 'Create Event'}</DialogTitle>
            <DialogDescription>Choose the schedule, audience, and delivery style for this event.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Event Name</label>
                <input
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className="surface-soft h-12 w-full rounded-[22px] px-4 text-sm"
                  placeholder="War Room"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Time</label>
                <input
                  value={form.time}
                  onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))}
                  type="time"
                  className="surface-soft h-12 w-full rounded-[22px] px-4 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Delivery Mode</label>
                <select
                  value={form.mode}
                  onChange={(event) => {
                    const nextMode = event.target.value;
                    setForm((current) => ({
                      ...current,
                      mode: nextMode,
                      targetType: nextMode === 'dm' ? 'user' : 'channel',
                      targetId: '',
                      mentionRoleId: '',
                    }));
                  }}
                  className="surface-soft h-12 w-full rounded-[22px] px-4 text-sm"
                >
                  <option value="server">Server</option>
                  <option value="dm">DM</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Cadence</label>
                <select
                  value={form.daily ? 'daily' : 'once'}
                  onChange={(event) => setForm((current) => ({ ...current, daily: event.target.value === 'daily' }))}
                  className="surface-soft h-12 w-full rounded-[22px] px-4 text-sm"
                >
                  <option value="once">One time</option>
                  <option value="daily">Daily</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Target Type</label>
                <select
                  value={form.targetType}
                  onChange={(event) => setForm((current) => ({ ...current, targetType: event.target.value, targetId: '' }))}
                  className="surface-soft h-12 w-full rounded-[22px] px-4 text-sm"
                >
                  {form.mode === 'server' ? (
                    <>
                      <option value="channel">Channel</option>
                      <option value="role">Role</option>
                    </>
                  ) : (
                    <>
                      <option value="user">User</option>
                      <option value="role">Role</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Target</label>
                <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => setTargetPickerOpen(true)}>
                  {currentTargetLabel}
                  <span className="text-xs text-[var(--text-muted)]">{form.targetId ? 'Selected' : 'Choose'}</span>
                </Button>
              </div>
              {form.mode === 'server' ? (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Mention Role</label>
                  <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => setRolePickerOpen(true)}>
                    {currentMentionRoleLabel}
                    <span className="text-xs text-[var(--text-muted)]">{form.mentionRoleId ? 'Selected' : 'Optional'}</span>
                  </Button>
                </div>
              ) : null}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={saveEvent}>Save Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailsEvent)} onOpenChange={(open) => {
        if (!open) {
          setDetailsEvent(null);
          setReasonOpenId('');
        }
      }}>
        <DialogContent className="w-[min(96vw,820px)]">
          <DialogHeader>
            <DialogTitle>{detailsEvent?.desc || 'Event Details'}</DialogTitle>
            <DialogDescription>Attendance, responses, and reminder details for this event.</DialogDescription>
          </DialogHeader>
          {detailsEvent ? (
            <DialogBody>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Date & Time</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {detailsEvent.event_date ? formatDate(detailsEvent.event_date) : (detailsEvent.time || 'Time not set')}
                  </p>
                </div>
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Target</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {targetLabelMap.get(detailsEvent.target_id) || detailsEvent.target_id || 'Not set'}
                  </p>
                </div>
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Mode</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {detailsEvent.delivery_mode || 'server'} / {detailsEvent.daily ? 'Daily' : 'One time'}
                  </p>
                </div>
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Status</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {detailsEvent.enabled ? 'Active' : 'Disabled'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[26px] border border-[var(--border)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-main)]">Attending List</h3>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">Members marked as attending.</p>
                    </div>
                    <Badge variant="success">{detailsEvent.attending?.length || 0}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {detailsEvent.attending?.length ? detailsEvent.attending.map((userId) => (
                      <div key={userId} className="surface-soft rounded-[20px] px-4 py-3 text-sm font-medium text-[var(--text-main)]">
                        {userLabelMap.get(String(userId)) || `User ${String(userId).slice(-4)}`}
                      </div>
                    )) : (
                      <div className="surface-soft rounded-[20px] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                        No attendance has been recorded yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[26px] border border-[var(--border)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-[var(--text-main)]">Responses</h3>
                      <p className="mt-1 text-sm text-[var(--text-muted)]">Members who cannot attend and their reasons.</p>
                    </div>
                    <Badge variant="warning">{detailsEvent.not_attending?.length || 0}</Badge>
                  </div>
                  <div className="mt-4 space-y-3">
                    {detailsEvent.not_attending?.length ? detailsEvent.not_attending.map((entry, index) => {
                      const id = `${entry.user_id || index}`;
                      const reasonVisible = reasonOpenId === id;
                      return (
                        <div key={id} className="surface-soft rounded-[20px] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-[var(--text-main)]">
                                {userLabelMap.get(String(entry.user_id)) || `User ${String(entry.user_id).slice(-4)}`}
                              </p>
                              <p className="mt-1 text-sm text-[var(--text-muted)]">
                                {entry.timestamp ? formatDate(entry.timestamp) : 'No timestamp'}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReasonOpenId((current) => current === id ? '' : id)}
                            >
                              {reasonVisible ? 'Hide Reason' : 'View Reason'}
                            </Button>
                          </div>
                          {reasonVisible ? (
                            <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{entry.reason || 'No reason provided.'}</p>
                          ) : null}
                        </div>
                      );
                    }) : (
                      <div className="surface-soft rounded-[20px] px-4 py-8 text-center text-sm text-[var(--text-muted)]">
                        No response list yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogBody>
          ) : null}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDetailsEvent(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SearchPickerDialog
        open={targetPickerOpen}
        onOpenChange={setTargetPickerOpen}
        title="Choose Target"
        description="Search members, roles, or channels based on the current target type."
        items={targetOptions({ channels: dashboard.channels, roles: dashboard.roles, users: dashboard.users, targetType: form.targetType })}
        selectedIds={form.targetId ? [form.targetId] : []}
        onConfirm={(ids) => setForm((current) => ({ ...current, targetId: ids[0] || '' }))}
        placeholder={`Search ${form.targetType}`}
      />

      <SearchPickerDialog
        open={rolePickerOpen}
        onOpenChange={setRolePickerOpen}
        title="Choose Mention Role"
        description="Optional role to mention when the event is posted in server mode."
        items={dashboard.roles.map((item) => ({ id: item.id, label: item.name, description: `Role ID ${item.id}` }))}
        selectedIds={form.mentionRoleId ? [form.mentionRoleId] : []}
        onConfirm={(ids) => setForm((current) => ({ ...current, mentionRoleId: ids[0] || '' }))}
        placeholder="Search roles"
      />
    </div>
  );
}
