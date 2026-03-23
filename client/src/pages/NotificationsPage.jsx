import { useState, useEffect } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../components/ui/dialog';

export default function NotificationsPage() {
  const { notifications, setNotifications, roster, showToast, handleError } = useDashboardContext();
  const [enabled, setEnabled] = useState(notifications.enabled);
  const [selectedIds, setSelectedIds] = useState(new Set(notifications.user_ids || []));
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [userDialogOpen, setUserDialogOpen] = useState(false);

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

  const handleEnableClick = () => {
    if (!enabled) {
      setUserDialogOpen(true);
    } else {
      setEnabled(false);
      saveSettings(false, selectedIds);
    }
  };

  const saveSettings = async (enable, ids) => {
    setSaving(true);
    try {
      const r = await api.post('/api/notifications', {
        enabled: enable,
        user_ids: [...ids],
      });
      setNotifications(r.data?.config || {});
      setEnabled(r.data?.config?.enabled ?? enable);
      setSelectedIds(new Set(r.data?.config?.user_ids || []));
      showToast('Notification settings saved.');
    } catch (err) { handleError(err, 'Failed to save.'); }
    finally { setSaving(false); }
  };

  const save = async () => {
    await saveSettings(true, selectedIds);
    setUserDialogOpen(false);
  };

  const filtered = roster.filter((u) =>
    `${u.name || ''} ${u.username || ''}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-[var(--text-main)]">Notifications</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Send system log DMs only to selected users.</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-[var(--text-main)]">DM Notifications</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {enabled ? `${selectedIds.size} user(s) receive DMs when events are created, updated, toggled, etc.` : 'Enable to select users who receive system log DMs.'}
              </p>
            </div>
            <button
              onClick={handleEnableClick}
              className={`relative h-7 w-12 rounded-full transition-colors ${enabled ? 'bg-cyan-500' : 'bg-black/20 dark:bg-white/15'}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </button>
          </div>
          {enabled && (
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={() => setUserDialogOpen(true)}>
                Edit Recipients ({selectedIds.size})
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select DM Recipients</DialogTitle>
            <DialogDescription>Choose users who will receive system log DMs. If OFF, no DMs are sent.</DialogDescription>
          </DialogHeader>
          <DialogBody>
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
                    selectedIds.has(user.id) ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-100' : 'text-[var(--text-muted)] hover:bg-black/5 dark:hover:bg-white/4'
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border text-xs ${
                    selectedIds.has(user.id) ? 'border-cyan-500 bg-cyan-500 text-white' : 'border-[var(--border)]'
                  }`}>
                    {selectedIds.has(user.id) ? '✓' : ''}
                  </div>
                  <span className="truncate">{user.name || user.username}</span>
                </button>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUserDialogOpen(false)}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save Selected Users</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
