import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquare, Users, BarChart3, ScrollText, Shield, Sun, Moon, LogOut, Bell, Menu, X, Zap, FileText, Hash } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeProvider';
import { DashboardContext } from '../lib/DashboardContext';
import { useDashboard } from '../hooks/useDashboard';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

const MAIN_NAV = [
  { id: 'overview', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'events', path: '/dashboard/events', label: 'Events', icon: Calendar },
  { id: 'welcome', path: '/dashboard/welcome', label: 'Welcome', icon: MessageSquare },
  { id: 'users', path: '/dashboard/users', label: 'Users', icon: Users },
  { id: 'activity', path: '/dashboard/activity', label: 'Activity', icon: BarChart3 },
  { id: 'strikes', path: '/dashboard/strikes', label: 'Strikes', icon: Zap },
  { id: 'autorole', path: '/dashboard/autorole', label: 'Auto Role', icon: Shield },
];

const SYSTEM_LOGS_NAV = [
  { id: 'system-logs', path: '/dashboard/logs', label: 'System Logs', icon: FileText },
];

const DISCORD_LOGS_NAV = [
  { id: 'discord-logs', path: '/dashboard/discord-logs', label: 'Logs', icon: Hash },
];

export default function DashboardLayout() {
  const dashboard = useDashboard();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (dashboard.loading && dashboard.events.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)]">
        <div className="flex flex-col items-center gap-6">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400/20 border-t-cyan-400" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
    );
  }

  const apiOnline = dashboard.ping >= 0;

  return (
    <DashboardContext.Provider value={dashboard}>
      <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-main)] transition-colors duration-300">



        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed left-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-sidebar)]/90 text-[var(--text-main)] backdrop-blur-lg lg:hidden"
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        {/* Sidebar overlay mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Sidebar */}
        <aside className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)] transition-transform duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          {/* Logo */}
          <div className="flex h-16 items-center gap-3 border-b border-[var(--border)] px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-teal-300 text-sm font-black text-slate-950">IB</div>
            <span className="text-lg font-bold tracking-tight">IND Blades</span>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto px-3 py-4">
            <div className="space-y-1">
              {MAIN_NAV.map((item) => {
                const active = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                const isExactDashboard = item.path === '/dashboard' && location.pathname === '/dashboard';
                const isActive = active || isExactDashboard;

                return (
                  <button
                    key={item.id}
                    onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                    className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.1)] border border-cyan-400/20'
                        : 'text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-main)] border border-transparent'
                    }`}
                  >
                    <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-cyan-400' : 'text-[var(--text-muted)] group-hover:text-cyan-400'}`} />
                    {item.label}
                  </button>
                );
              })}

              <div className="pt-2">
                <p className="px-4 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-50">Intelligence Logs</p>
                {SYSTEM_LOGS_NAV.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                      className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 ${
                        isActive
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-400/20'
                          : 'text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-main)] border border-transparent'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-cyan-400' : 'text-[var(--text-muted)] group-hover:text-cyan-400'}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4">
                <p className="px-4 mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--text-muted)] opacity-50">Discord Stream</p>
                {DISCORD_LOGS_NAV.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.id}
                      onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                      className={`group flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200 ${
                        isActive
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-400/20'
                          : 'text-[var(--text-muted)] hover:bg-white/[0.04] hover:text-[var(--text-main)] border border-transparent'
                      }`}
                    >
                      <item.icon className={`h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-cyan-400' : 'text-[var(--text-muted)] group-hover:text-cyan-400'}`} />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>

          <div className="border-t border-[var(--border)] px-4 py-4 space-y-2">
            <div className={`flex items-center gap-3 rounded-2xl border px-3 py-1.5 transition-all duration-500 ${apiOnline ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
              <div className="relative flex h-2 w-2">
                <div className={`absolute h-full w-full animate-ping rounded-full opacity-75 ${apiOnline ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <div className={`relative h-2 w-2 rounded-full ${apiOnline ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]' : 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]'}`} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${apiOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
                API: {apiOnline ? 'Linked' : 'Offline'}
              </span>
            </div>

            <div className={`flex items-center gap-3 rounded-2xl border px-3 py-1.5 transition-all duration-500 ${dashboard.botStatus === 'connected' ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
              <div className="relative flex h-2 w-2">
                <div className={`absolute h-full w-full animate-ping rounded-full opacity-75 ${dashboard.botStatus === 'connected' ? 'bg-cyan-400' : 'bg-rose-400'}`} />
                <div className={`relative h-2 w-2 rounded-full ${dashboard.botStatus === 'connected' ? 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' : 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]'}`} />
              </div>
              <span className={`text-[10px] font-black uppercase tracking-widest ${dashboard.botStatus === 'connected' ? 'text-cyan-400' : 'text-rose-400'}`}>
                Bot: {dashboard.botStatus === 'connected' ? 'Active' : 'Offline'}
              </span>
            </div>
          </div>
        </aside>

        {/* Main area */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top navbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-main)]/80 px-4 backdrop-blur-xl sm:px-8">
            <div className="pl-12 lg:pl-0">
              <h1 className="text-lg font-bold tracking-tight">IND Blades</h1>
            </div>

            <div className="flex items-center gap-2">
              {dashboard.liveSync && (
                <Badge variant="success" className="hidden sm:inline-flex">Live</Badge>
              )}

              <button
                onClick={toggleTheme}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/5 text-[var(--text-muted)] transition hover:bg-white/10 hover:text-[var(--text-main)]"
                title="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              <button
                onClick={() => navigate('/dashboard/notifications')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/5 text-[var(--text-muted)] transition hover:bg-white/10 hover:text-[var(--text-main)]"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
              </button>

              <button
                onClick={dashboard.logout}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-[var(--border)] bg-white/5 px-4 text-sm font-medium text-[var(--text-muted)] transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-200"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </header>

          {/* Error banner */}
          {dashboard.errorMessage && (
            <div className="mx-4 mt-4 rounded-2xl border border-rose-300/20 bg-rose-300/8 px-5 py-3 text-sm font-medium text-rose-100 sm:mx-8">
              {dashboard.errorMessage}
            </div>
          )}

          {/* Page content */}
          <main className="flex-1 p-4 sm:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </DashboardContext.Provider>
  );
}
