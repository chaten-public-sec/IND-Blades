import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { LayoutDashboard, Calendar, MessageSquare, Users, BarChart3, ScrollText, Shield, Sun, Moon, LogOut, Bell, Menu, X, Zap } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTheme } from './ThemeProvider';
import { DashboardContext } from '../lib/DashboardContext';
import { useDashboard } from '../hooks/useDashboard';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';

const NAV_ITEMS = [
  { id: 'overview', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'events', path: '/dashboard/events', label: 'Events', icon: Calendar },
  { id: 'welcome', path: '/dashboard/welcome', label: 'Welcome', icon: MessageSquare },
  { id: 'users', path: '/dashboard/users', label: 'Users', icon: Users },
  { id: 'activity', path: '/dashboard/activity', label: 'Activity', icon: BarChart3 },
  { id: 'logs', path: '/dashboard/logs', label: 'Logs', icon: ScrollText },
  { id: 'strikes', path: '/dashboard/strikes', label: 'Strikes', icon: Zap },
  { id: 'autorole', path: '/dashboard/autorole', label: 'Auto Role', icon: Shield },
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

        {/* Toast */}
        {dashboard.toast && (
          <div className="fixed bottom-6 right-6 z-[200] surface rounded-2xl px-5 py-3 text-sm font-medium shadow-lg animate-[fadeIn_0.2s_ease]">
            {dashboard.toast}
          </div>
        )}

        {/* Mobile sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="fixed left-4 top-4 z-[60] flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white backdrop-blur-lg lg:hidden"
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
              {NAV_ITEMS.map((item) => {
                const active = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                const isExactDashboard = item.path === '/dashboard' && location.pathname === '/dashboard';
                const isActive = active || isExactDashboard;

                return (
                  <button
                    key={item.id}
                    onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-cyan-400/12 text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                        : 'text-[var(--text-muted)] hover:bg-white/5 hover:text-[var(--text-main)]'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Sidebar footer */}
          <div className="border-t border-[var(--border)] px-4 py-4">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <div className={`h-2 w-2 rounded-full ${apiOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]'}`} />
              {apiOnline ? `Online · ${dashboard.ping}ms` : 'Offline'}
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
