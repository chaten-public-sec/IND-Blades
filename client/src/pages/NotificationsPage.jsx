import { useState, useEffect } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';

export default function NotificationsPage() {
  const { notifications, setNotifications, roster, showToast, handleError } = useDashboardContext();
  const [enabled, setEnabled] = useState(notifications.enabled);
  const [selectedIds, setSelectedIds] = useState(new Set(notifications.user_ids || []));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setEnabled(notifications.enabled);
    setSelectedIds(new Set(notifications.user_ids || []));
  }, [notifications]);

  const toggleUser = (id) => {
    setSelectedIds((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.post('/api/notifications', {
        enabled,
        user_ids: [...selectedIds],
      });
      setNotifications(r.data?.config || {});
      showToast('Notification settings saved.');
    } catch (err) { handleError(err, 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const filtered = roster.filter((u) =>
    `${u.name || ''} ${u.username || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Notifications</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Send DM notifications when actions happen on the dashboard.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">DM Notifications</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Selected users will receive DMs when events are created, updated, toggled, etc.</p>
            </div>
            <button
              onClick={() => setEnabled((e) => !e)}
              className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? 'bg-cyan-400' : 'bg-white/15'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      {enabled && (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Select Recipients</h3>
              <span className="text-sm text-[var(--text-muted)]">{selectedIds.size} selected</span>
            </div>

            <input
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="surface-soft mb-4 h-10 w-full rounded-2xl px-4 text-sm text-[var(--text-main)]"
            />

            <div className="max-h-[320px] space-y-1 overflow-y-auto">
              {filtered.map((user) => (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    selectedIds.has(user.id) ? 'bg-cyan-400/10 text-cyan-100' : 'text-[var(--text-muted)] hover:bg-white/4'
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${
                    selectedIds.has(user.id) ? 'border-cyan-400 bg-cyan-400 text-slate-950' : 'border-white/20'
                  }`}>
                    {selectedIds.has(user.id) ? '✓' : ''}
                  </div>
                  <span className="truncate">{user.name || user.username}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>Save Settings</Button>
      </div>
    </div>
  );
}
