import { useMemo, useState } from 'react';
import { AlertTriangle, BellRing, CheckCheck, CheckCircle2, Info } from 'lucide-react';
import { useDashboardContext } from '../lib/DashboardContext';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import SectionHeader from '../components/SectionHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const toneMap = {
  strike_update: {
    icon: AlertTriangle,
    wrapper: 'bg-amber-500/12 text-amber-400',
  },
  role_assignment: {
    icon: CheckCircle2,
    wrapper: 'bg-emerald-500/12 text-emerald-400',
  },
  default: {
    icon: Info,
    wrapper: 'bg-[var(--primary-soft)] text-[var(--primary)]',
  },
};

function resolveTone(type) {
  return toneMap[type] || toneMap.default;
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

export default function NotificationsPage() {
  const dashboard = useDashboardContext();
  const [loadingId, setLoadingId] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = dashboard.notificationCenter.filter((item) => !item.read_at).length;
  const readCount = dashboard.notificationCenter.length - unreadCount;
  const actorMap = useMemo(() => {
    const map = new Map();
    dashboard.users.forEach((user) => map.set(String(user.id), user.name));
    return map;
  }, [dashboard.users]);

  const markRead = async (notificationId) => {
    setLoadingId(notificationId);
    try {
      await api.post(`/api/notifications/center/${notificationId}/read`);
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'Notification marked as read.', `notification-read-${notificationId}`);
    } catch (error) {
      dashboard.handleError(error, 'Unable to update that notification.');
    } finally {
      setLoadingId('');
    }
  };

  const markAllRead = async () => {
    setMarkingAll(true);
    try {
      await api.post('/api/notifications/center/read-all');
      await dashboard.loadDashboard(true);
      dashboard.showToast('success', 'All notifications marked as read.', 'notification-read-all');
    } catch (error) {
      dashboard.handleError(error, 'Unable to mark all notifications as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Notifications"
        title="Notification Center"
        description="Live updates for strikes, reviews, role changes, and other dashboard activity appear here in one clean feed."
        actions={(
          <Button variant="secondary" onClick={markAllRead} loading={markingAll}>
            <CheckCheck className="h-4 w-4" />
            Mark all as read
          </Button>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard label="Total Notifications" value={dashboard.notificationCenter.length} note="Everything currently available in your feed." />
        <MetricCard label="Unread" value={unreadCount} note="Items you have not opened yet." />
        <MetricCard label="Read" value={readCount} note="Items already acknowledged." />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Live Feed</CardTitle>
          <CardDescription>The full notification stream updates automatically as new events happen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {dashboard.notificationCenter.length ? dashboard.notificationCenter.map((item) => {
            const tone = resolveTone(item.type);
            const Icon = tone.icon;
            return (
              <div key={item.id} className="surface-soft rounded-[26px] p-5">
                <div className="flex items-start gap-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[16px] ${tone.wrapper}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-base font-semibold text-[var(--text-main)]">{item.title}</p>
                      <Badge variant={item.read_at ? 'neutral' : 'default'}>
                        {item.read_at ? 'Read' : 'Unread'}
                      </Badge>
                      <span className="ml-auto text-xs text-[var(--text-muted)]">{formatDate(item.created_at)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{item.message}</p>
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      {item.actor_user_id ? (
                        <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          By {actorMap.get(String(item.actor_user_id)) || item.actor_user_id}
                        </p>
                      ) : null}
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
            <div className="surface-soft rounded-[26px] px-5 py-12 text-center text-sm text-[var(--text-muted)]">
              Nothing to show yet. New dashboard activity will appear here automatically.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
