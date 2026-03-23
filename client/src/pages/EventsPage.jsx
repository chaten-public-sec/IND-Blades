import { useState, useCallback } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { SelectField } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../components/ui/dialog';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/table';
import { Label } from '../components/ui/label';
import { Calendar, Clock, MapPin, Users, Zap, Trash2, Edit2, Play, Pause, AlertCircle } from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const emptyForm = { id: '', name: '', hour: '18', minute: '00', daily: false, mode: 'server', targetType: 'channel', targetId: '', mentionRoleId: '', vcChannelId: '' };

function buildForm(event) {
  if (!event) return { ...emptyForm };
  const [h, m] = (event.time || '18:00').split(':');
  return {
    id: event.id || '',
    name: event.desc || '',
    hour: h || '18',
    minute: m || '00',
    daily: Boolean(event.daily),
    mode: event.delivery_mode === 'dm' ? 'dm' : 'server',
    targetType: event.target_type || (event.delivery_mode === 'dm' ? 'user' : 'channel'),
    targetId: event.target_id || '',
    mentionRoleId: event.mention_role_id || '',
    vcChannelId: event.vc_channel_id || '',
  };
}

function formatDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getStatusInfo(event) {
  if (!event.enabled) return { label: 'Disabled', variant: 'danger' };
  if (event.voting_closed) return { label: 'Completed', variant: 'default' };
  return { label: 'Running', variant: 'success' };
}

export default function EventsPage() {
  const { events, channels, roles, roster, showToast, handleError } = useDashboardContext();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [errors, setErrors] = useState({});
  const [selectedEvent, setSelectedEvent] = useState(null);

  // Delete confirmation dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reasonDialogOpen, setReasonDialogOpen] = useState(false);
  const [reasonTarget, setReasonTarget] = useState(null);

  const update = useCallback((field, value) => {
    setForm((f) => {
      const overrides = {};
      if (field === 'mode') {
        if (value === 'dm' && f.targetType === 'channel') overrides.targetType = 'user';
        if (value === 'server' && f.targetType !== 'channel') overrides.targetType = 'channel';
        overrides.targetId = '';
      }
      if (field === 'targetType') {
        overrides.targetId = '';
        if (value === 'channel') overrides.mode = 'server';
        else overrides.mode = 'dm';
      }
      return { ...f, [field]: value, ...overrides };
    });
    setErrors(prev => ({ ...prev, [field]: '' }));
  }, []);

  const openCreate = () => { setForm({ ...emptyForm }); setErrors({}); setOpen(true); };
  const openEdit = (e) => { setForm(buildForm(e)); setErrors({}); setOpen(true); };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Event name is required';
    if (!form.targetId) e.targetId = 'Target destination is required';
    if (form.mode === 'dm' && form.targetType === 'user' && !form.targetId) e.targetId = 'Select a user';
    
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        id: form.id || undefined,
        name: form.name.trim(),
        time: `${form.hour}:${form.minute}`,
        daily: form.daily,
        mode: form.mode,
        target_type: form.targetType,
        target_id: form.targetId,
        mention_role_id: form.mentionRoleId || null,
        vc_channel_id: form.vcChannelId || null,
      };
      if (form.id) {
        await api.post('/api/events/update', payload);
        showToast('success', 'Event updated successfully', 'event-update');
      } else {
        await api.post('/api/events/create', payload);
        showToast('success', 'Event created successfully', 'event-create');
      }
      setOpen(false);
    } catch (err) { handleError(err, 'Failed to save event.'); }
    finally { setSaving(false); }
  };

  const openDeleteConfirm = (event) => {
    setDeleteTarget(event);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.post('/api/events/delete', { id: deleteTarget.id });
      showToast('success', 'Event deleted successfully', 'event-delete');
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (err) { handleError(err, 'Failed to delete.'); }
    finally { setDeleting(false); }
  };

  const toggle = async (event) => {
    try { 
      await api.post('/api/events/toggle', { id: event.id, enabled: !event.enabled }); 
      showToast('success', event.enabled ? 'Event paused' : 'Event resumed', 'event-toggle'); 
    }
    catch (err) { handleError(err, 'Failed to toggle.'); }
  };

  const getUserName = (id) => {
    const u = roster.find(r => r.id === id);
    return u ? (u.name || u.username) : `User ${id.slice(-4)}`;
  };

  // Dynamically update the detail dialog with latest data
  const liveSelectedEvent = selectedEvent ? events.find(e => e.id === selectedEvent.id) || selectedEvent : null;

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Events</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Create and manage scheduled events.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Zap className="h-4 w-4" />
          Create Event
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Event</TableHeaderCell>
                <TableHeaderCell>Time</TableHeaderCell>
                <TableHeaderCell>Mode</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Last Triggered</TableHeaderCell>
                <TableHeaderCell>Attendance</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => {
                const status = getStatusInfo(event);
                return (
                  <TableRow key={event.id}>
                    <TableCell onClick={() => setSelectedEvent(event)} className="cursor-pointer group">
                      <div className="flex items-center gap-3">
                        <div className={`h-2 w-2 rounded-full ${status.variant === 'success' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
                        <div>
                          <p className="font-bold text-cyan-400 group-hover:underline underline-offset-4">{event.desc}</p>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">
                            {event.daily ? 'Recurring Daily' : 'One-time Event'}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">{event.time}</TableCell>
                    <TableCell>
                      <Badge variant={event.delivery_mode === 'dm' ? 'warning' : 'default'}>
                        {event.delivery_mode === 'dm' ? 'DM' : 'Server'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-[var(--text-muted)]">
                      {formatDate(event.last_reminded_date)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-green-400">✅ {event.attending?.length || 0}</span>
                        <span className="text-xs font-bold text-red-400">❌ {event.not_attending?.length || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(event)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => toggle(event)}>{event.enabled ? 'Pause' : 'Resume'}</Button>
                        <Button size="sm" variant="danger" onClick={() => openDeleteConfirm(event)}>Delete</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-[var(--text-muted)]">No events yet. Create one to get started.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={Boolean(liveSelectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{liveSelectedEvent?.desc}</DialogTitle>
            <DialogDescription>Real-time attendance details</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="surface-soft rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-green-400">{liveSelectedEvent?.attending?.length || 0}</p>
                <p className="text-xs font-semibold text-[var(--text-muted)] mt-1">Attending</p>
              </div>
              <div className="surface-soft rounded-xl p-4 text-center">
                <p className="text-3xl font-bold text-red-400">{liveSelectedEvent?.not_attending?.length || 0}</p>
                <p className="text-xs font-semibold text-[var(--text-muted)] mt-1">Not Attending</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <h4 className="font-bold text-green-600 dark:text-green-400">✅ Attending ({liveSelectedEvent?.attending?.length || 0})</h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                  {liveSelectedEvent?.attending?.length > 0 ? (
                    liveSelectedEvent.attending.map(id => (
                      <div key={id} className="surface-soft rounded-lg p-2 text-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                        {getUserName(id)}
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic">No one yet</p>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-2">
                  <h4 className="font-bold text-red-600 dark:text-red-400">❌ Not Sure ({liveSelectedEvent?.not_attending?.length || 0})</h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                  {liveSelectedEvent?.not_attending?.length > 0 ? (
                    liveSelectedEvent.not_attending.map((item, i) => {
                      const entry = typeof item === 'object' && item?.user_id ? item : { user_id: item, reason: 'No reason', timestamp: null };
                      const uid = entry.user_id;
                      return (
                        <div key={uid + i} className="surface-soft rounded-lg p-2 text-sm flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-400" />
                            {getUserName(uid)}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => { setReasonTarget(entry); setReasonDialogOpen(true); }}>
                            View Reason
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] italic">No one yet</p>
                  )}
                </div>
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedEvent(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Reason Dialog */}
      <Dialog open={reasonDialogOpen} onOpenChange={setReasonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Not Sure Reason</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {reasonTarget && (
              <div className="space-y-3">
                <p><strong>User:</strong> {getUserName(reasonTarget.user_id)}</p>
                <p><strong>Reason:</strong> {reasonTarget.reason || 'No reason provided'}</p>
                <p><strong>Timestamp:</strong> {reasonTarget.timestamp ? formatDate(reasonTarget.timestamp) : '—'}</p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReasonDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {deleteTarget && (
              <div className="surface-soft rounded-xl p-4">
                <p className="font-semibold">{deleteTarget.desc}</p>
                <p className="text-sm text-[var(--text-muted)] mt-1">Time: {deleteTarget.time} · {deleteTarget.daily ? 'Daily' : 'Once'}</p>
              </div>
            )}
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setDeleteOpen(false); setDeleteTarget(null); }}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>Delete Permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Event' : 'Create Event'}</DialogTitle>
            <DialogDescription>Configure event details and delivery.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]" htmlFor="event-name">
                  Event Title
                </Label>
                <div className="relative">
                  <input
                    id="event-name"
                    value={form.name}
                    onChange={(e) => update('name', e.target.value)}
                    placeholder="e.g. Competitive Scrims, Community Hangout"
                    autoFocus
                    className={`surface-soft h-12 w-full rounded-2xl pl-11 pr-4 text-sm text-[var(--text-main)] transition-all focus:ring-2 focus:ring-cyan-500/20 ${errors.name ? 'border-red-500/50 bg-red-500/5' : 'focus:border-cyan-500/30'}`}
                  />
                  <Calendar className={`absolute left-4 top-3.5 h-5 w-5 ${errors.name ? 'text-red-400' : 'text-[var(--text-muted)]'}`} />
                </div>
                {errors.name && <p className="flex items-center gap-1 text-[10px] font-medium text-red-400"><AlertCircle className="h-3 w-3" /> {errors.name}</p>}
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Schedule Time (IST)</Label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <SelectField value={form.hour} onChange={(e) => update('hour', e.target.value)} className="pl-10">
                        {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                      </SelectField>
                      <Clock className="absolute left-3.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                    </div>
                    <span className="text-[var(--text-muted)] font-bold">:</span>
                    <div className="relative flex-1">
                      <SelectField value={form.minute} onChange={(e) => update('minute', e.target.value)} className="pl-10">
                        {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </SelectField>
                      <Clock className="absolute left-3.5 top-2.5 h-4 w-4 text-[var(--text-muted)]" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                   <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Recurrence Type</Label>
                   <SelectField value={form.daily ? 'daily' : 'once'} onChange={(e) => update('daily', e.target.value === 'daily')}>
                     <option value="once">Run Once (Manual Reset)</option>
                     <option value="daily">Daily Automatic</option>
                   </SelectField>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/5 bg-white/3 p-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                   <MapPin className="h-4 w-4 text-cyan-400" />
                   <h4 className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">Delivery Configuration</h4>
                </div>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Delivery Method</Label>
                    <SelectField value={form.mode} onChange={(e) => update('mode', e.target.value)}>
                      <option value="server">Server Message (Public)</option>
                      <option value="dm">Direct Message (Private)</option>
                    </SelectField>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Target Type</Label>
                    <SelectField value={form.targetType} onChange={(e) => update('targetType', e.target.value)}>
                      {form.mode === 'server' && <option value="channel">Internal Channel</option>}
                      {form.mode === 'dm' && <option value="user">Specific User</option>}
                      {form.mode === 'dm' && <option value="role">Member Group (Role)</option>}
                    </SelectField>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className={`text-[10px] font-bold uppercase tracking-widest ${errors.targetId ? 'text-red-400' : 'text-[var(--text-muted)]'}`}>
                    Select Target {form.targetType === 'channel' ? 'Channel' : form.targetType === 'role' ? 'Role' : 'User'}
                  </Label>
                  <SelectField 
                    value={form.targetId} 
                    onChange={(e) => update('targetId', e.target.value)}
                    className={errors.targetId ? 'border-red-500/50 bg-red-500/5' : ''}
                  >
                    <option value="" disabled>Choose an option...</option>
                    {form.targetType === 'channel' && channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    {form.targetType === 'role' && roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                    {form.targetType === 'user' && roster.map((u) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                  </SelectField>
                  {errors.targetId && <p className="text-[10px] font-medium text-red-400">{errors.targetId}</p>}
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-white/5 bg-white/3 p-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                   <Users className="h-4 w-4 text-emerald-400" />
                   <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Advanced Settings</h4>
                </div>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  {form.mode === 'server' && (
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Mention Role</Label>
                      <SelectField value={form.mentionRoleId} onChange={(e) => update('mentionRoleId', e.target.value)}>
                        <option value="">No Mention</option>
                        {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                      </SelectField>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Event Voice Channel</Label>
                    <SelectField value={form.vcChannelId} onChange={(e) => update('vcChannelId', e.target.value)}>
                      <option value="">No VC Redirect</option>
                      {((channels || []).filter((c) => c.type === 2).length ? (channels || []).filter((c) => c.type === 2) : (channels || [])).map((c) => (
                        <option key={c.id} value={c.id}>#{c.name}</option>
                      ))}
                    </SelectField>
                  </div>
                </div>
                <p className="text-[10px] text-[var(--text-muted)] leading-relaxed italic">
                  * Enabling VC Redirect adds a one-click "Join VC" button for attendees.
                </p>
              </div>
            </div>
          </DialogBody>
          <DialogFooter className="bg-[var(--bg-sidebar)]/30 px-6 py-4">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving} className="min-w-[120px] shadow-lg shadow-cyan-500/10">
              {form.id ? 'Save Changes' : 'Create Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
