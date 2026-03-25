import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCheck, CheckCircle2, Info, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/cn';
import { formatDate } from '../lib/format';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

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
  const [items, setItems] = useState(dashboard.notificationCenter);
  const [exitingIds, setExitingIds] = useState([]);

  useEffect(() => {
    setItems(dashboard.notificationCenter);
  }, [dashboard.notificationCenter]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  const removeNotifications = (ids) => {
    const idSet = new Set(ids.map(String));
    setItems((current) => current.filter((item) => !idSet.has(String(item.id))));
    dashboard.setNotificationCenter?.((current) => current.filter((item) => !idSet.has(String(item.id))));
  };

  const animateOut = (ids) => {
    const idSet = new Set(ids.map(String));
    setExitingIds((current) => Array.from(new Set([...current, ...Array.from(idSet)])));
    window.setTimeout(() => {
      removeNotifications(Array.from(idSet));
      setExitingIds((current) => current.filter((item) => !idSet.has(String(item))));
    }, 180);
  };

  const dismissNotification = async (id) => {
    setLoadingId(id);
    animateOut([id]);
    try {
      await api.post(`/api/notifications/center/${id}/dismiss`);
    } catch (error) {
      await dashboard.loadDashboard(true);
      dashboard.handleError(error, 'Unable to update that notification.');
    } finally {
      setLoadingId('');
    }
  };

  const clearAll = async () => {
    setClearing(true);
    const currentIds = items.map((item) => item.id);
    animateOut(currentIds);
    try {
      await api.post('/api/notifications/center/clear-all');
      dashboard.showToast('success', 'All notifications cleared.', 'notification-clear-all');
    } catch (error) {
      await dashboard.loadDashboard(true);
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
          'fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm transition',
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        )}
      />

      <aside
        className={cn(
          'fixed right-0 top-0 z-[80] flex h-screen w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--bg-panel)]/98 shadow-[0_28px_80px_-30px_rgba(2,6,23,0.95)] backdrop-blur-xl transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="border-b border-[var(--border)] px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[var(--text-muted)]">Notifications</p>
              <h3 className="text-2xl font-semibold text-[var(--text-main)]">Notification Center</h3>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                Live updates for strikes, roles, approvals, and other dashboard activity.
              </p>
            </div>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="surface-soft rounded-[22px] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Unread</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{unreadCount}</p>
            </div>
            <div className="surface-soft rounded-[22px] p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--text-muted)]">Total</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-main)]">{items.length}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <Badge variant={unreadCount ? 'default' : 'neutral'}>
            {unreadCount} unread
          </Badge>
          <Button size="sm" variant="secondary" loading={clearing} onClick={clearAll} disabled={!items.length}>
            <CheckCheck className="h-4 w-4" />
            Clear all
          </Button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {items.length ? (
            items.map((item) => {
              const tone = resolveTone(item);
              const Icon = notificationIcon[tone] || Info;
              const exiting = exitingIds.includes(String(item.id));

              return (
                <div
                  key={item.id}
                  className={cn(
                    'surface-soft rounded-[26px] p-4 transition duration-200',
                    exiting ? '-translate-x-6 opacity-0' : 'translate-x-0 opacity-100'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px]',
                        tone === 'warning'
                          ? 'bg-amber-500/12 text-amber-400'
                          : tone === 'success'
                            ? 'bg-emerald-500/12 text-emerald-400'
                            : 'bg-[var(--primary-soft)] text-[var(--primary)]'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[var(--text-main)]">{item.title}</p>
                            {!item.read_at ? <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" /> : null}
                          </div>
                          <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{item.message}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs text-[var(--text-muted)]">{formatDate(item.created_at)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={loadingId === item.id}
                          onClick={() => dismissNotification(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="surface-soft flex h-16 w-16 items-center justify-center rounded-[22px] text-[var(--primary)]">
                <Info className="h-6 w-6" />
              </div>
              <p className="mt-5 text-lg font-semibold text-[var(--text-main)]">Nothing new</p>
              <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                New strike updates, approvals, and role actions will appear here automatically.
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
