import { useDashboardContext } from '../lib/DashboardContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

function formatDate(v) {
  if (!v) return 'N/A';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleString();
}

export default function OverviewPage() {
  const { roster, events, ping, liveSync, health, config } = useDashboardContext();
  const apiOnline = ping >= 0;
  const activeEvents = events.filter((e) => e.enabled).length;

  return (
    <div className="space-y-8 animate-[fadeIn_0.3s_ease]">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Overview of your server at a glance.</p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Total Members</p>
            <p className="mt-2 text-3xl font-bold">{roster.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Active Events</p>
            <p className="mt-2 text-3xl font-bold">{activeEvents} <span className="text-lg font-normal text-[var(--text-muted)]">/ {events.length}</span></p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">API Latency</p>
            <p className={`mt-2 text-3xl font-bold ${apiOnline ? 'text-emerald-300' : 'text-rose-300'}`}>{apiOnline ? `${ping}ms` : 'Offline'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Real-time Sync</p>
            <div className="mt-2 flex items-center gap-2">
              <div className={`h-2.5 w-2.5 rounded-full ${liveSync ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'}`} />
              <span className="text-lg font-semibold">{liveSync ? 'Connected' : 'Reconnecting'}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Health */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">System Status</h3>
            <Badge variant={apiOnline ? 'success' : 'danger'}>{apiOnline ? 'Healthy' : 'Offline'}</Badge>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Discord Token</p>
              <p className="mt-1 text-sm">{health.has_discord_credentials ? 'Connected' : 'Missing'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Welcome Channel</p>
              <p className="mt-1 text-sm">{config.channel_id || 'Default'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">Last Data Sync</p>
              <p className="mt-1 text-sm">{formatDate(health.reminders_last_updated_at)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
