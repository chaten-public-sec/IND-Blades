import { useDashboardContext } from '../lib/DashboardContext';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Users, Calendar, Activity, Zap, ShieldCheck, Bell, Server, Clock } from 'lucide-react';

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[var(--text-main)]">Overview</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)] font-medium">Global intelligence and system health.</p>
        </div>
        <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/5 px-4 py-2">
           <div className={`h-2 w-2 rounded-full ${liveSync ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
           <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-main)]">
              {liveSync ? 'Real-time Streaming' : 'Resting Connection'}
           </span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="relative overflow-hidden group">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Total Members</p>
                  <p className="text-4xl font-black text-[var(--text-main)]">{roster.length}</p>
               </div>
               <div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-400 transition-transform group-hover:scale-110">
                  <Users className="h-6 w-6" />
               </div>
            </div>
            <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
               <div className="h-full bg-cyan-500 w-full opacity-50" />
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl" />
        </Card>

        <Card className="relative overflow-hidden group">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Active Events</p>
                  <p className="text-4xl font-black text-[var(--text-main)]">{activeEvents}</p>
               </div>
               <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400 transition-transform group-hover:scale-110">
                  <Calendar className="h-6 w-6" />
               </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <Badge variant="secondary" className="text-[10px]">{events.length} Total</Badge>
               <span className="text-[10px] text-[var(--text-muted)] font-medium">Tracked events</span>
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl" />
        </Card>

        <Card className="relative overflow-hidden group border-emerald-500/20">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">API Latency</p>
                  <p className={`text-4xl font-black ${apiOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                     {apiOnline ? `${ping}ms` : 'FAIL'}
                  </p>
               </div>
               <div className={`rounded-xl ${apiOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'} p-2.5 transition-transform group-hover:scale-110`}>
                  <Activity className="h-6 w-6" />
               </div>
            </div>
            <p className="mt-4 text-[10px] font-medium text-[var(--text-muted)] tracking-tight">
               Endpoint response strength
            </p>
          </CardContent>
          <div className={`absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-24 h-24 ${apiOnline ? 'bg-emerald-500/10' : 'bg-rose-500/10'} rounded-full blur-2xl`} />
        </Card>

        <Card className="relative overflow-hidden group">
          <CardContent className="pt-6">
            <div className="flex justify-between items-start">
               <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1">Bot Status</p>
                  <p className="text-4xl font-black text-[var(--text-main)]">{liveSync ? 'ACTIVE' : 'IDLE'}</p>
               </div>
               <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400 transition-transform group-hover:scale-110">
                  <Zap className="h-6 w-6" />
               </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
               <div className={`h-2 w-2 rounded-full ${liveSync ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
               <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">
                  {liveSync ? 'System Uplink' : 'Offline Mode'}
               </span>
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl" />
        </Card>
      </div>

      {/* Health */}
      <Card className="overflow-hidden border border-white/5 bg-white/[0.02]">
        <CardContent className="pt-8">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
               <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-400">
                  <ShieldCheck className="h-6 w-6" />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-[var(--text-main)]">System Intelligence</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Operational Integrity</p>
               </div>
            </div>
            <Badge variant={apiOnline ? 'success' : 'danger'} className="px-4 py-1.5 text-sm uppercase font-black tracking-widest">
               {apiOnline ? 'Operational' : 'Degraded'}
            </Badge>
          </div>
          
          <div className="grid gap-10 lg:grid-cols-3">
            <div className="space-y-3 p-6 rounded-3xl bg-white/[0.03] border border-white/5 transition-all hover:bg-white/[0.05]">
              <div className="flex items-center gap-2 mb-2">
                 <Server className="h-4 w-4 text-cyan-400" />
                 <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Discord Credentials</p>
              </div>
              <div className="flex flex-col gap-1">
                 <p className={`text-lg font-black ${health.has_discord_credentials ? 'text-cyan-400' : 'text-rose-400'}`}>
                    {health.has_discord_credentials ? 'VALIDATED' : 'MISSING'}
                 </p>
                 <p className="text-[10px] font-medium text-[var(--text-muted)]">Token authentication status</p>
              </div>
            </div>

            <div className="space-y-3 p-6 rounded-3xl bg-white/[0.03] border border-white/5 transition-all hover:bg-white/[0.05]">
              <div className="flex items-center gap-2 mb-2">
                 <Bell className="h-4 w-4 text-amber-400" />
                 <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Target Infrastructure</p>
              </div>
              <div className="flex flex-col gap-1">
                 <p className="text-lg font-black text-[var(--text-main)] truncate">
                    {config.channel_id ? `#${config.channel_id}` : 'DEFAULT'}
                 </p>
                 <p className="text-[10px] font-medium text-[var(--text-muted)]">Primary broadcast channel</p>
              </div>
            </div>

            <div className="space-y-3 p-6 rounded-3xl bg-white/[0.03] border border-white/5 transition-all hover:bg-white/[0.05]">
              <div className="flex items-center gap-2 mb-2">
                 <Clock className="h-4 w-4 text-indigo-400" />
                 <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Last Intelligence Sync</p>
              </div>
              <div className="flex flex-col gap-1">
                 <p className="text-lg font-black text-[var(--text-main)]">
                    {formatDate(health.reminders_last_updated_at).split(',')[0]}
                 </p>
                 <p className="text-[10px] font-medium text-[var(--text-muted)]">
                    Timed at {formatDate(health.reminders_last_updated_at).split(',')[1] || 'Unknown'}
                 </p>
              </div>
            </div>
          </div>
          
          <div className="mt-10 flex items-center justify-between border-t border-white/5 pt-6 text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-widest">
             <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <span>All subsystems operational</span>
             </div>
             <span>Engine Version 2.4.0 (Stable)</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
