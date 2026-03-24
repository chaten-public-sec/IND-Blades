import { useState } from 'react';
import { AlertTriangle, CheckCheck, CheckCircle2, Info, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { cn } from '../lib/cn';

const notificationIcon = {
  success: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

function resolveTone(item) {
  if (item.type === 'strike_update') return 'warning';
  if (item.type === 'role_assignment') return 'success';
  return 'info';
}

export default function NotificationDrawer({ open, onClose, dashboard }) {
  const [loadingId, setLoadingId] = useState('');
  const [clearing, setClearing] = useState(false);

  const markRead = async (id) => {
    setLoadingId(id);
    try {
      await api.post(`/api/notifications/center/${id}/read`);
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'Marked as read.', `notification-read-${id}`);
    } catch (error) {
      dashboard.handleError(error, 'Unable to update that notification.');
    } finally {
      setLoadingId('');
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      await api.post('/api/notifications/center/read-all');
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'All notifications cleared.', 'notification-clear-all');
    } catch (error) {
      dashboard.handleError(error, 'Unable to clear notifications.');
    } finally {
      setClearing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-hidden={!open}
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm transition',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
      />
      <aside className={cn(
        'fixed right-0 top-0 z-[80] flex h-screen w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-panel)] shadow-[0_20px_80px_-32px_rgba(2,6,23,0.92)] backdrop-blur-xl transition-transform duration-300',
        open ? 'translate-x-0' : 'translate-x-full'
      )}>
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Notifications</p>
            <h3 className="mt-1 text-xl font-semibold text-[var(--text-main)]">Notification Center</h3>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <Badge variant={dashboard.unreadNotifications ? 'default' : 'neutral'}>
            {dashboard.unreadNotifications} unread
          </Badge>
          <Button size="sm" variant="secondary" loading={clearing} onClick={clearAll}>
            <CheckCheck className="h-4 w-4" />
            Clear all
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {dashboard.notificationCenter.length ? dashboard.notificationCenter.map((item) => {
            const tone = resolveTone(item);
            const Icon = notificationIcon[tone] || Info;

            return (
              <div key={item.id} className="surface-soft rounded-[24px] p-4">
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'mt-0.5 flex h-10 w-10 items-center justify-center rounded-[14px]',
                    tone === 'warning' ? 'bg-amber-500/12 text-amber-400' : tone === 'success' ? 'bg-emerald-500/12 text-emerald-400' : 'bg-blue-500/12 text-blue-400'
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--text-main)]">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{item.message}</p>
                      </div>
                      {!item.read_at ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" /> : null}
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-[var(--text-muted)]">{formatDate(item.created_at)}</span>
                      {!item.read_at ? (
                        <Button size="sm" variant="ghost" loading={loadingId === item.id} onClick={() => markRead(item.id)}>
                          Mark read
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--text-muted)]">
              No notifications yet.
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
