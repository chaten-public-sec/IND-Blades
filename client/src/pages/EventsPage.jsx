import { useMemo, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CalendarPlus2, Eye, Pencil, Power, Trash2, Users, AlertCircle, Clock, Hash, Shield, Megaphone, Mic, CalendarDays, Activity, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/cn';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { hasPermission } from '../lib/access';
import { formatDate } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import SearchPickerDialog from '../components/SearchPickerDialog';
import { SelectField } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';

const eventSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Event name is required'),
  time: z.string().trim().min(1, 'Time is required'),
  daily: z.boolean(),
  mode: z.enum(['server', 'dm']),
  targetType: z.enum(['channel', 'role', 'user']),
  targetId: z.string().trim().min(1, 'Destination is required'),
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
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
      <AlertCircle className="h-4 w-4" />
      <p>{message}</p>
    </div>
  );
}

function targetOptions({ channels, roles, users, targetType }) {
  if (targetType === 'channel') {
    return channels.map((item) => ({ id: item.id, label: item.name, description: `Channel ID ${item.id}`, icon: Hash }));
  }
  if (targetType === 'role') {
    return roles.map((item) => ({ id: item.id, label: item.name, description: `Role ID ${item.id}`, icon: Shield }));
  }
  return users.map((item) => ({ id: item.id, label: item.name, description: item.username ? `@${item.username}` : `User ID ${item.id}`, icon: Users }));
}

function MetricCard({ label, value, note, icon: Icon, trend }) {
  return (
    <Card className="overflow-hidden border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          </div>
          {trend && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {trend}
            </Badge>
          )}
        </div>
        <div className="mt-4">
          <p className="text-3xl font-semibold text-gray-900 dark:text-white">{value}</p>
          {note && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{note}</p>}
        </div>
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
        dashboard.showToast('success', 'Event schedule updated.', `event-update-${values.id}`);
      } else {
        await api.post('/api/events/create', payload);
        dashboard.showToast('success', 'New event configured.', 'event-create');
      }

      setDialogOpen(false);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Failed to save event configuration.');
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
      dashboard.handleError(error, 'Failed to change event status.');
    }
  };

  const deleteEvent = async (event) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${event.desc}"?`)) return;
    
    try {
      await api.post('/api/events/delete', { id: event.id });
      dashboard.showToast('success', 'Event deleted permanently.', `event-delete-${event.id}`);
      await dashboard.loadDashboard(true);
    } catch (error) {
      dashboard.handleError(error, 'Failed to delete event.');
    }
  };

  const activeEvents = dashboard.events.filter((item) => item.enabled).length;
  const disabledEvents = dashboard.events.length - activeEvents;
  const currentTargetLabel = targetLabelMap.get(String(formValues.targetId || '')) || 'Select Destination';
  const currentMentionRoleLabel = targetLabelMap.get(String(formValues.mentionRoleId || '')) || 'Select Role (Optional)';
  const currentVcLabel = targetLabelMap.get(String(formValues.vcChannelId || '')) || 'Select VC (Optional)';

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Scheduling"
        title="Event Operations"
        description="Configure automated server announcements, track attendance, and manage Voice Channel routing for upcoming activities."
        actions={canCreate && (
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
            <CalendarPlus2 className="mr-2 h-4 w-4" />
            Create Event
          </Button>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard 
          label="Total Events" 
          value={dashboard.events.length} 
          icon={CalendarDays}
          trend="All configurations"
        />
        <MetricCard 
          label="Active Deployments" 
          value={activeEvents} 
          icon={Activity}
          trend="Currently running"
        />
        <MetricCard 
          label="Disabled Schedules" 
          value={disabledEvents} 
          icon={Power}
          trend="Paused"
        />
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Configured Events</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          {dashboard.events.length ? dashboard.events.map((event) => (
            <Card key={event.id} className={`overflow-hidden transition-all ${event.enabled ? 'border-blue-200 bg-white shadow-sm dark:border-blue-900/30 dark:bg-gray-900' : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50'}`}>
              <CardContent className="p-0">
                <div className="border-b border-gray-100 p-5 dark:border-gray-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-gray-900 dark:text-white">{event.desc}</h4>
                        <Badge variant={event.enabled ? 'default' : 'secondary'} className={event.enabled ? 'bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400' : ''}>
                          {event.enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4" />
                          {event.time} {event.daily ? '(Daily)' : '(Once)'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Megaphone className="h-4 w-4" />
                          {event.delivery_mode === 'dm' ? 'Direct Message' : 'Server Channel'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-gray-100 bg-gray-50/50 dark:divide-gray-800 dark:bg-gray-800/30 sm:grid-cols-4 sm:divide-y-0">
                  <div className="p-4 text-center">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Attending</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{event.attending?.length || 0}</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Declined</p>
                    <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{event.not_attending?.length || 0}</p>
                  </div>
                  <div className="col-span-2 p-4 sm:col-span-2">
                    <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Target Route</p>
                    <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                      {targetLabelMap.get(String(event.target_id || '')) || 'Unknown Target'}
                    </p>
                    {event.vc_channel_id && (
                      <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">
                        VC: {targetLabelMap.get(String(event.vc_channel_id)) || 'Unknown'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                  <Button variant="outline" size="sm" onClick={() => setDetailsEvent(event)}>
                    <Eye className="mr-2 h-4 w-4" /> View Details
                  </Button>
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(event)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>
                  )}
                  {canToggle && (
                    <Button variant="outline" size="sm" onClick={() => toggleEvent(event)}>
                      <Power className={`mr-2 h-4 w-4 ${event.enabled ? 'text-red-500' : 'text-green-500'}`} /> 
                      {event.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  )}
                  {canDelete && (
                    <Button variant="ghost" size="icon" className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20" onClick={() => deleteEvent(event)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )) : (
            <div className="col-span-full rounded-md border border-dashed border-gray-300 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-900">
              <CalendarPlus2 className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">No events configured</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Get started by creating your first scheduled event.</p>
              {canCreate && (
                <Button onClick={openCreate} className="mt-6">
                  Create Event
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[min(96vw,600px)] rounded-md border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader className="mb-4 border-b border-gray-100 pb-4 dark:border-gray-800">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              {formValues.id ? 'Edit Event Configuration' : 'Create New Event'}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              Define the schedule, audience, and delivery method for this event.
            </DialogDescription>
          </DialogHeader>
          
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Event Name / Description</label>
                <input
                  {...register('name')}
                  className={cn(
                    "w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100",
                    errors.name ? "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700" : "border-gray-300 focus:ring-blue-500/20 dark:border-gray-700"
                  )}
                  placeholder="e.g., Weekly Team Sync"
                />
                <FieldError message={errors.name?.message} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Execution Time (HH:MM)</label>
                <input
                  {...register('time')}
                  type="time"
                  className={cn(
                    "w-full rounded-md border bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 dark:bg-gray-800 dark:text-gray-100",
                    errors.time ? "border-red-300 focus:border-red-500 focus:ring-red-500/20 dark:border-red-700" : "border-gray-300 focus:ring-blue-500/20 dark:border-gray-700"
                  )}
                />
                <FieldError message={errors.time?.message} />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Recurrence</label>
                <select
                  value={formValues.daily ? 'daily' : 'once'}
                  onChange={(e) => setValue('daily', e.target.value === 'daily', { shouldDirty: true })}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="once">Execute Once</option>
                  <option value="daily">Execute Daily</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery Method</label>
                <select
                  value={formValues.mode}
                  onChange={(e) => {
                    const nextMode = e.target.value;
                    setValue('mode', nextMode, { shouldDirty: true });
                    setValue('targetType', nextMode === 'dm' ? 'user' : 'channel', { shouldDirty: true });
                    setValue('targetId', '', { shouldDirty: true, shouldValidate: true });
                    setValue('mentionRoleId', '', { shouldDirty: true });
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="server">Server Broadcast</option>
                  <option value="dm">Direct Message (DM)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Target Type</label>
                <select
                  value={formValues.targetType}
                  onChange={(e) => {
                    setValue('targetType', e.target.value, { shouldDirty: true });
                    setValue('targetId', '', { shouldDirty: true, shouldValidate: true });
                  }}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  {formValues.mode === 'server' ? (
                    <>
                      <option value="channel">Specific Channel</option>
                      <option value="role">Role (Members)</option>
                    </>
                  ) : (
                    <>
                      <option value="user">Specific User</option>
                      <option value="role">Role (DM All)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5 border-t border-gray-100 pt-2 dark:border-gray-800 sm:col-span-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Destination Route</label>
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full justify-start font-normal text-left",
                    errors.targetId ? "border-red-300 focus:ring-red-500/20 dark:border-red-700" : "hover:bg-gray-50 dark:hover:bg-gray-800"
                  )}
                  onClick={() => setTargetPickerOpen(true)}
                >
                  {formValues.targetId ? (
                    <span className="truncate text-gray-900 dark:text-white">{currentTargetLabel}</span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">Click to select destination...</span>
                  )}
                </Button>
                <FieldError message={errors.targetId?.message} />
              </div>

              {formValues.mode === 'server' && (
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Optional Mention Role</label>
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="w-full justify-start font-normal text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                    onClick={() => setRolePickerOpen(true)}
                  >
                    {formValues.mentionRoleId ? (
                      <span className="truncate text-gray-900 dark:text-white">{currentMentionRoleLabel}</span>
                    ) : (
                      <span className="text-gray-500 dark:text-gray-400">No role selected to ping...</span>
                    )}
                  </Button>
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Mic className="h-4 w-4 text-gray-500" />
                  Linked Voice Channel (Optional)
                </label>
                <Button 
                  type="button" 
                  variant="outline" 
                  className="w-full justify-start font-normal text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => setVcPickerOpen(true)}
                >
                  {formValues.vcChannelId ? (
                    <span className="truncate text-gray-900 dark:text-white">{currentVcLabel}</span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">Select VC for "Join Event" action...</span>
                  )}
                </Button>
              </div>
            </div>
          </DialogBody>
          
          <DialogFooter className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button loading={saving} onClick={saveEvent} className="bg-blue-600 text-white hover:bg-blue-700">Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detailsEvent)} onOpenChange={(open) => {
        if (!open) {
          setDetailsEvent(null);
          setReasonOpenId('');
        }
      }}>
        <DialogContent className="w-[min(96vw,800px)] overflow-hidden rounded-md border-gray-200 bg-gray-50 p-0 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-900 dark:text-white">{detailsEvent?.desc || 'Event Record'}</DialogTitle>
              <DialogDescription className="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed analytics and configuration state.</DialogDescription>
            </DialogHeader>
          </div>
          
          {detailsEvent && (
            <div className="p-6">
              <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Execution Time</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {detailsEvent.event_date ? formatDate(detailsEvent.event_date) : (detailsEvent.time || 'Pending')}
                  </p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Routing</p>
                  <p className="mt-1 truncate font-semibold text-gray-900 dark:text-white" title={targetLabelMap.get(String(detailsEvent.target_id || ''))}>
                    {targetLabelMap.get(String(detailsEvent.target_id || '')) || 'Not specified'}
                  </p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Protocol</p>
                  <p className="mt-1 font-semibold text-gray-900 dark:text-white">
                    {detailsEvent.delivery_mode === 'dm' ? 'Direct Msg' : 'Broadcast'}
                  </p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-800/50">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Linked VC</p>
                  <p className="mt-1 truncate font-semibold text-gray-900 dark:text-white">
                    {targetLabelMap.get(String(detailsEvent.vc_channel_id || '')) || 'None'}
                  </p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="border-gray-200 shadow-sm dark:border-gray-800 dark:bg-gray-800/30">
                  <CardHeader className="border-b border-gray-100 p-4 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-gray-900 dark:text-white">Attendance Roster</CardTitle>
                      <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        {detailsEvent.attending?.length || 0} Confirmed
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[250px] overflow-y-auto p-2">
                      {detailsEvent.attending?.length ? detailsEvent.attending.map((userId) => (
                        <div key={userId} className="mb-2 flex items-center rounded bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm dark:bg-gray-800 dark:text-gray-300">
                          <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                          {userLabelMap.get(String(userId)) || `ID: ${String(userId).slice(-6)}`}
                        </div>
                      )) : (
                        <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400">
                          <Users className="mb-2 h-8 w-8 opacity-20" />
                          No RSVPs recorded yet.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-sm dark:border-gray-800 dark:bg-gray-800/30">
                  <CardHeader className="border-b border-gray-100 p-4 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base text-gray-900 dark:text-white">Declined Responses</CardTitle>
                      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500">
                        {detailsEvent.not_attending?.length || 0} Excused
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[250px] overflow-y-auto p-2">
                      {detailsEvent.not_attending?.length ? detailsEvent.not_attending.map((entry, index) => {
                        const id = `${entry.user_id || index}`;
                        const reasonVisible = reasonOpenId === id;
                        return (
                          <div key={id} className="mb-2 rounded border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {userLabelMap.get(String(entry.user_id)) || `ID: ${String(entry.user_id).slice(-6)}`}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {entry.timestamp ? formatDate(entry.timestamp) : 'Time unknown'}
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setReasonOpenId((current) => (current === id ? '' : id))}
                              >
                                {reasonVisible ? 'Hide' : 'Read'} Reason
                              </Button>
                            </div>
                            {reasonVisible && (
                              <div className="mt-3 rounded bg-gray-50 p-2 text-sm text-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
                                {entry.reason || <span className="italic text-gray-400">No specific reason provided.</span>}
                              </div>
                            )}
                          </div>
                        );
                      }) : (
                        <div className="flex h-full flex-col items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400">
                          <Users className="mb-2 h-8 w-8 opacity-20" />
                          No declined RSVPs.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
          
          <div className="border-t border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <Button variant="outline" className="w-full" onClick={() => setDetailsEvent(null)}>Close Record</Button>
          </div>
        </DialogContent>
      </Dialog>

      <SearchPickerDialog
        open={targetPickerOpen}
        onOpenChange={setTargetPickerOpen}
        title="Select Target Destination"
        description={`Choose the specific ${formValues.targetType} to receive this event notification.`}
        items={targetOptions({ channels: dashboard.channels, roles: dashboard.roles, users: dashboard.users, targetType: formValues.targetType })}
        selectedIds={formValues.targetId ? [formValues.targetId] : []}
        onConfirm={(ids) => setValue('targetId', ids[0] || '', { shouldDirty: true, shouldValidate: true })}
        placeholder={`Search available ${formValues.targetType}s...`}
      />

      <SearchPickerDialog
        open={rolePickerOpen}
        onOpenChange={setRolePickerOpen}
        title="Select Mention Role"
        description="Choose a role to ping when the event announcement is posted."
        items={dashboard.roles.map((item) => ({ id: item.id, label: item.name, description: `Role ID ${item.id}`, icon: Shield }))}
        selectedIds={formValues.mentionRoleId ? [formValues.mentionRoleId] : []}
        onConfirm={(ids) => setValue('mentionRoleId', ids[0] || '', { shouldDirty: true })}
        placeholder="Search roles..."
      />

      <SearchPickerDialog
        open={vcPickerOpen}
        onOpenChange={setVcPickerOpen}
        title="Select Voice Channel"
        description="Link a Voice Channel for the automated 'Join Event VC' action button."
        items={voiceChannels.map((item) => ({ id: item.id, label: item.name, description: `Voice channel ${item.id}`, icon: Mic }))}
        selectedIds={formValues.vcChannelId ? [formValues.vcChannelId] : []}
        onConfirm={(ids) => setValue('vcChannelId', ids[0] || '', { shouldDirty: true })}
        placeholder="Search voice channels..."
      />
    </div>
  );
}