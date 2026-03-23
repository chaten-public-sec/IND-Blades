import { useState, useEffect } from 'react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody, DialogFooter } from '../components/ui/dialog';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Bell, Users, Search, CheckCircle, XCircle } from 'lucide-react';

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
      showToast('success', 'Notification settings updated', 'notifications-save');
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
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bell className={`h-4 w-4 ${enabled ? 'text-cyan-400' : 'text-slate-500'}`} />
                <h3 className="text-lg font-semibold text-[var(--text-main)]">System Log DMs</h3>
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                {enabled 
                  ? `${selectedIds.size} recipient(s) will receive direct messages for all system events.`
                  : 'Enable to select members who will receive DMs for event updates and strikes.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Label htmlFor="notif-toggle" className="text-sm font-medium text-[var(--text-muted)] cursor-pointer">
                {enabled ? 'System Active' : 'System Disabled'}
              </Label>
              <Switch 
                id="notif-toggle"
                checked={enabled} 
                onCheckedChange={handleEnableClick} 
              />
            </div>
          </div>

          {enabled && (
             <div className="mt-8 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                   <h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Active Recipients</h4>
                   <Button variant="outline" size="sm" onClick={() => setUserDialogOpen(true)} className="h-7 text-[10px] uppercase font-bold tracking-widest">
                     Manage List
                   </Button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                   {[...selectedIds].map(id => {
                      const user = roster.find(u => u.id === id);
                      return (
                         <div key={id} className="flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 rounded-full px-3 py-1">
                            <div className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                            <span className="text-xs font-medium text-cyan-200">{user?.name || user?.username || `User ${id.slice(-4)}`}</span>
                         </div>
                      );
                   })}
                   {selectedIds.size === 0 && (
                      <p className="text-sm italic text-amber-400/80 py-2">No recipients selected. System is active but sending no notifications.</p>
                   )}
                </div>
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
            <div className="relative mb-6">
               <input
                 placeholder="Search members by name or ID..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="surface-soft h-11 w-full rounded-2xl pl-11 pr-4 text-sm text-[var(--text-main)] transition-all focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500/30"
               />
               <Search className="absolute left-4 top-3.5 h-4 w-4 text-[var(--text-muted)]" />
            </div>

            <div className="max-h-[360px] space-y-1.5 overflow-y-auto pr-2 custom-scrollbar">
              {filtered.map((user) => (
                <button
                  key={user.id}
                  onClick={() => toggleUser(user.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-all ${
                    selectedIds.has(user.id) 
                      ? 'bg-cyan-500/10 border border-cyan-500/20 ring-1 ring-cyan-500/10' 
                      : 'border border-transparent text-[var(--text-muted)] hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                     <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${selectedIds.has(user.id) ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}>
                        {(user.name || user.username || '?')[0].toUpperCase()}
                     </div>
                     <div>
                        <p className={`text-sm font-semibold ${selectedIds.has(user.id) ? 'text-cyan-100' : 'text-[var(--text-main)]'}`}>
                           {user.name || user.username}
                        </p>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">{user.id}</p>
                     </div>
                  </div>
                  
                  <div className={`h-5 w-5 rounded-full flex items-center justify-center transition-all ${
                    selectedIds.has(user.id) ? 'bg-cyan-500 text-white scale-110 shadow-lg shadow-cyan-500/20' : 'border border-[var(--border)]'
                  }`}>
                    {selectedIds.has(user.id) && <CheckCircle className="h-3.5 w-3.5" />}
                  </div>
                </button>
              ))}
              {filtered.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-10 text-center opacity-50">
                    <XCircle className="h-10 w-10 mb-2" />
                    <p className="text-sm font-medium">No members match your search.</p>
                 </div>
              )}
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
