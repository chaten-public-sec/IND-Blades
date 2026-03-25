import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarPlus2, Eye, Pencil, Power, Trash2, Users, Volume2 } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/access';
import { formatDate } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { SelectField } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

const eventSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'This field is required'),
  time: z.string().trim().min(1, 'This field is required'),
  daily: z.boolean(),
  mode: z.enum(['server', 'dm']),
  targetType: z.enum(['channel', 'role', 'user']),
  targetId: z.string().trim().min(1, 'This field is required'),
  mentionRoleId: z.string().optional(),
  vcChannelId: z.string().optional(),
});

const EMPTY_FORM = {
  id: '',
  name: '',
  time: '18:00',
  daily: false,
  mode: 'server',
  targetType: 'channel',
  targetId: '',
  mentionRoleId: '',
  vcChannelId: '',
};

function FieldError({ message }) {
  if (!message) return null;
  return <p className="text-sm font-medium text-rose-300">{message}</p>;
}

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
  const [vcPickerOpen, setVcPickerOpen] = useState(false);
  const [detailsEvent, setDetailsEvent] = useState(null);
  const [reasonOpenId, setReasonOpenId] = useState('');
  const [saving, setSaving] = useState(false);

  const {
    register,
    reset,
    setValue,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: EMPTY_FORM,
  });

  const formValues = watch();
  const voiceChannels = useMemo(
    () => dashboard.channels.filter((item) => Number(item.type) === 2),
    [dashboard.channels]
  );

  const targetLabelMap = useMemo(() => {
    const map = new Map();
    dashboard.channels.forEach((item) => map.set(String(item.id), item.name));
    dashboard.roles.forEach((item) => map.set(String(item.id), item.name));
    dashboard.users.forEach((item) => map.set(String(item.id), item.name));
    return map;
  }, [dashboard.channels, dashboard.roles, dashboard.users]);

  const userLabelMap = useMemo(() => {
    const map = new Map();
    dashboard.users.forEach((item) => map.set(String(item.id), item.name));
    return map;
  }, [dashboard.users]);

  const openCreate = () => {
    reset(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (event) => {
    reset({
      id: event.id,
      name: event.desc,
      time: event.time || '18:00',
      daily: Boolean(event.daily),
      mode: event.delivery_mode || 'server',
      targetType: event.target_type || 'channel',
      targetId: String(event.target_id || ''),
      mentionRoleId: String(event.mention_role_id || ''),
      vcChannelId: String(event.vc_channel_id || ''),
    });
    setDialogOpen(true);
  };

  const saveEvent = handleSubmit(async (values) => {
    setSaving(true);
    try {
      const payload = {
        id: values.id || undefined,
        name: values.name,
        time: values.time,
        daily: values.daily,
        delivery_mode: values.mode,
        target_type: values.targetType,
        target_id: values.targetId,
        mention_role_id: values.mentionRoleId || null,
        vc_channel_id: values.vcChannelId || null,
      };

      if (values.id) {
        await api.post('/api/events/update', payload);
        dashboard.showToast('success', 'Event updated successfully.', `event-update-${values.id}`);
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
  });

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
  const currentTargetLabel = targetLabelMap.get(String(formValues.targetId || '')) || 'Choose target';
  const currentMentionRoleLabel = targetLabelMap.get(String(formValues.mentionRoleId || '')) || 'Choose role';
  const currentVcLabel = targetLabelMap.get(String(formValues.vcChannelId || '')) || 'Choose voice channel';

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Events"
        title="Events"
        description="Create, review, and manage upcoming event reminders with controlled forms and live updates."
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
                    {event.daily ? 'Daily event' : 'One-time event'} / {event.delivery_mode || 'server'} / {targetLabelMap.get(String(event.target_id || '')) || 'No target'}
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
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Event VC</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {targetLabelMap.get(String(event.vc_channel_id || '')) || 'Not set'}
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
            <DialogTitle>{formValues.id ? 'Edit Event' : 'Create Event'}</DialogTitle>
            <DialogDescription>Choose the schedule, audience, and event VC without losing selected values.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Event Name</label>
                <input
                  {...register('name')}
                  className={`surface-soft h-12 w-full rounded-[22px] px-4 text-sm ${errors.name ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                  placeholder="War Room"
                />
                <FieldError message={errors.name?.message} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Time</label>
                <input
                  {...register('time')}
                  type="time"
                  className={`surface-soft h-12 w-full rounded-[22px] px-4 text-sm ${errors.time ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                />
                <FieldError message={errors.time?.message} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Delivery Mode</label>
                <SelectField
                  value={formValues.mode}
                  onChange={(event) => {
                    const nextMode = event.target.value;
                    setValue('mode', nextMode, { shouldDirty: true });
                    setValue('targetType', nextMode === 'dm' ? 'user' : 'channel', { shouldDirty: true });
                    setValue('targetId', '', { shouldDirty: true, shouldValidate: true });
                    setValue('mentionRoleId', '', { shouldDirty: true });
                  }}
                  className="h-12 rounded-[22px]"
                >
                  <option value="server">Server</option>
                  <option value="dm">DM</option>
                </SelectField>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Cadence</label>
                <SelectField
                  value={formValues.daily ? 'daily' : 'once'}
                  onChange={(event) => setValue('daily', event.target.value === 'daily', { shouldDirty: true })}
                  className="h-12 rounded-[22px]"
                >
                  <option value="once">One time</option>
                  <option value="daily">Daily</option>
                </SelectField>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Target Type</label>
                <SelectField
                  value={formValues.targetType}
                  onChange={(event) => {
                    setValue('targetType', event.target.value, { shouldDirty: true });
                    setValue('targetId', '', { shouldDirty: true, shouldValidate: true });
                  }}
                  className="h-12 rounded-[22px]"
                >
                  {formValues.mode === 'server' ? (
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
                </SelectField>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Target</label>
                <Button
                  type="button"
                  variant="secondary"
                  className={`w-full justify-between ${errors.targetId ? 'border border-rose-400/35 bg-rose-500/8' : ''}`}
                  onClick={() => setTargetPickerOpen(true)}
                >
                  {currentTargetLabel}
                  <span className="text-xs text-[var(--text-muted)]">{formValues.targetId ? 'Selected' : 'Choose'}</span>
                </Button>
                <FieldError message={errors.targetId?.message} />
              </div>

              {formValues.mode === 'server' ? (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Mention Role</label>
                  <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => setRolePickerOpen(true)}>
                    {currentMentionRoleLabel}
                    <span className="text-xs text-[var(--text-muted)]">{formValues.mentionRoleId ? 'Selected' : 'Optional'}</span>
                  </Button>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-[0.22em] text-[var(--text-muted)]">Event Voice Channel</label>
              <Button type="button" variant="secondary" className="w-full justify-between" onClick={() => setVcPickerOpen(true)}>
                <span className="truncate">{currentVcLabel}</span>
                <span className="text-xs text-[var(--text-muted)]">{formValues.vcChannelId ? 'Selected' : 'Optional'}</span>
              </Button>
              <p className="text-sm text-[var(--text-muted)]">When a member clicks attend, the bot will send the event VC join action for this channel.</p>
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
            <DialogDescription>Attendance, responses, delivery target, and event VC details.</DialogDescription>
          </DialogHeader>
          {detailsEvent ? (
            <DialogBody>
              <div className="grid gap-4 md:grid-cols-5">
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Date & Time</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {detailsEvent.event_date ? formatDate(detailsEvent.event_date) : (detailsEvent.time || 'Time not set')}
                  </p>
                </div>
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Target</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {targetLabelMap.get(String(detailsEvent.target_id || '')) || detailsEvent.target_id || 'Not set'}
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
                <div className="surface-soft rounded-[22px] p-4">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Event VC</p>
                  <p className="mt-2 text-sm font-semibold text-[var(--text-main)]">
                    {targetLabelMap.get(String(detailsEvent.vc_channel_id || '')) || 'Not set'}
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
                              onClick={() => setReasonOpenId((current) => (current === id ? '' : id))}
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
        items={targetOptions({ channels: dashboard.channels, roles: dashboard.roles, users: dashboard.users, targetType: formValues.targetType })}
        selectedIds={formValues.targetId ? [formValues.targetId] : []}
        onConfirm={(ids) => setValue('targetId', ids[0] || '', { shouldDirty: true, shouldValidate: true })}
        placeholder={`Search ${formValues.targetType}`}
      />

      <SearchPickerDialog
        open={rolePickerOpen}
        onOpenChange={setRolePickerOpen}
        title="Choose Mention Role"
        description="Optional role to mention when the event is posted in server mode."
        items={dashboard.roles.map((item) => ({ id: item.id, label: item.name, description: `Role ID ${item.id}` }))}
        selectedIds={formValues.mentionRoleId ? [formValues.mentionRoleId] : []}
        onConfirm={(ids) => setValue('mentionRoleId', ids[0] || '', { shouldDirty: true })}
        placeholder="Search roles"
      />

      <SearchPickerDialog
        open={vcPickerOpen}
        onOpenChange={setVcPickerOpen}
        title="Choose Event Voice Channel"
        description="Members who click attend will receive the Fam Event VC join action for this voice channel."
        items={voiceChannels.map((item) => ({ id: item.id, label: item.name, description: `Voice channel ${item.id}` }))}
        selectedIds={formValues.vcChannelId ? [formValues.vcChannelId] : []}
        onConfirm={(ids) => setValue('vcChannelId', ids[0] || '', { shouldDirty: true })}
        placeholder="Search voice channels"
      />
    </div>
  );
}
