import { useState, useCallback } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { SelectField } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../components/ui/dialog';
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from '../components/ui/table';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

const emptyForm = { id: '', name: '', hour: '18', minute: '00', daily: false, mode: 'server', targetType: 'channel', targetId: '', mentionRoleId: '' };

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
  };
}

export default function EventsPage() {
  const { events, channels, roles, roster, showToast, handleError } = useDashboardContext();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [selectedEvent, setSelectedEvent] = useState(null);

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
  }, []);

  const openCreate = () => { setForm({ ...emptyForm }); setOpen(true); };
  const openEdit = (e) => { setForm(buildForm(e)); setOpen(true); };

  const save = async () => {
    if (!form.name.trim()) return showToast('Event name is required.');
    if (!form.targetId) return showToast('Please select a target.');
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
      };
      if (form.id) {
        await api.post('/api/events/update', payload);
        showToast('Event updated.');
      } else {
        await api.post('/api/events/create', payload);
        showToast('Event created.');
      }
      setOpen(false);
    } catch (err) { handleError(err, 'Failed to save event.'); }
    finally { setSaving(false); }
  };

  const remove = async (id) => {
    if (!confirm('Delete this event permanently?')) return;
    try { await api.post('/api/events/delete', { id }); showToast('Event deleted.'); }
    catch (err) { handleError(err, 'Failed to delete.'); }
  };

  const toggle = async (event) => {
    try { await api.post('/api/events/toggle', { id: event.id, enabled: !event.enabled }); showToast(event.enabled ? 'Event paused.' : 'Event resumed.'); }
    catch (err) { handleError(err, 'Failed to toggle.'); }
  };

  const getUserName = (id) => {
    const u = roster.find(r => r.id === id);
    return u ? (u.name || u.username) : `User ${id.slice(-4)}`;
  };

  return (
    <div className="space-y-6 animate-[fadeIn_0.3s_ease]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Events</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Create and manage scheduled events.</p>
        </div>
        <Button onClick={openCreate}>+ New Event</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Event</TableHeaderCell>
                <TableHeaderCell>Time</TableHeaderCell>
                <TableHeaderCell>Route</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Attendance</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id}>
                  <TableCell onClick={() => setSelectedEvent(event)} className="cursor-pointer hover:bg-white/5 transition-colors">
                    <p className="font-semibold text-cyan-400 underline-offset-4 hover:underline">{event.desc}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">{event.daily ? 'Daily' : 'Once'}</p>
                  </TableCell>
                  <TableCell className="font-mono">{event.time}</TableCell>
                  <TableCell>
                    <p className="capitalize">{event.target_type || 'channel'}</p>
                    <p className="text-xs text-[var(--text-muted)]">{event.delivery_mode === 'dm' ? 'DM' : 'Server'}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={event.enabled ? 'success' : 'danger'}>{event.enabled ? 'Active' : 'Paused'}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-green-400">✅ {event.attending?.length || 0}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-red-400">❌ {event.not_attending?.length || 0}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(event)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => toggle(event)}>{event.enabled ? 'Pause' : 'Resume'}</Button>
                      <Button size="sm" variant="danger" onClick={() => remove(event.id)}>Delete</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {events.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-[var(--text-muted)]">No events yet. Create one to get started.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.desc}</DialogTitle>
            <DialogDescription>Real-time attendance details</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h4 className="font-bold text-green-400">✅ Attending ({selectedEvent?.attending?.length || 0})</h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                  {selectedEvent?.attending?.length > 0 ? (
                    selectedEvent.attending.map(id => (
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
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <h4 className="font-bold text-red-400">❌ Not Attending ({selectedEvent?.not_attending?.length || 0})</h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                  {selectedEvent?.not_attending?.length > 0 ? (
                    selectedEvent.not_attending.map(id => (
                      <div key={id} className="surface-soft rounded-lg p-2 text-sm flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-400" />
                        {getUserName(id)}
                      </div>
                    ))
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

      {/* Event Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Event' : 'Create Event'}</DialogTitle>
            <DialogDescription>Configure event details and delivery.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-[var(--text-muted)]">Event Name</label>
                <input
                  value={form.name}
                  onChange={(e) => update('name', e.target.value)}
                  placeholder="e.g. Movie Night, Raid Session"
                  autoFocus
                  className="surface-soft h-11 w-full rounded-2xl px-4 text-sm text-[var(--text-main)] transition focus:border-cyan-300/30"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)]">Hour (IST)</label>
                  <SelectField value={form.hour} onChange={(e) => update('hour', e.target.value)}>
                    {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                  </SelectField>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)]">Minute</label>
                  <SelectField value={form.minute} onChange={(e) => update('minute', e.target.value)}>
                    {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </SelectField>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)]">Recurrence</label>
                  <SelectField value={form.daily ? 'daily' : 'once'} onChange={(e) => update('daily', e.target.value === 'daily')}>
                    <option value="once">Run Once</option>
                    <option value="daily">Daily</option>
                  </SelectField>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)]">Method</label>
                  <SelectField value={form.mode} onChange={(e) => update('mode', e.target.value)}>
                    <option value="server">Server Message</option>
                    <option value="dm">Direct Message</option>
                  </SelectField>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)]">Target Type</label>
                  <SelectField value={form.targetType} onChange={(e) => update('targetType', e.target.value)}>
                    {form.mode === 'server' && <option value="channel">Channel</option>}
                    {form.mode === 'dm' && <option value="user">User</option>}
                    {form.mode === 'dm' && <option value="role">Role (all members)</option>}
                  </SelectField>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)]">Target</label>
                  {form.targetType === 'channel' && (
                    <SelectField value={form.targetId} onChange={(e) => update('targetId', e.target.value)}>
                      <option value="" disabled>Select channel</option>
                      {channels.map((c) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                    </SelectField>
                  )}
                  {form.targetType === 'role' && (
                    <SelectField value={form.targetId} onChange={(e) => update('targetId', e.target.value)}>
                      <option value="" disabled>Select role</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                    </SelectField>
                  )}
                  {form.targetType === 'user' && (
                    <SelectField value={form.targetId} onChange={(e) => update('targetId', e.target.value)}>
                      <option value="" disabled>Select user</option>
                      {roster.map((u) => <option key={u.id} value={u.id}>{u.name || u.username}</option>)}
                    </SelectField>
                  )}
                </div>
              </div>

              {form.mode === 'server' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-[var(--text-muted)]">Mention Role (optional)</label>
                  <SelectField value={form.mentionRoleId} onChange={(e) => update('mentionRoleId', e.target.value)}>
                    <option value="">None</option>
                    {roles.map((r) => <option key={r.id} value={r.id}>@{r.name}</option>)}
                  </SelectField>
                </div>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>{form.id ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
