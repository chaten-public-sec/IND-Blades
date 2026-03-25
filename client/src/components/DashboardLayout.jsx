import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileClock,
  LayoutGrid,
  Menu,
  PartyPopper,
  ScrollText,
  Settings2,
  Shield,
  Users2,
  X,
} from 'lucide-react';
import { DashboardContext } from '../lib/DashboardContext';
import { useDashboard } from '../hooks/useDashboard';
import { useTheme } from './ThemeProvider';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';
import RoleBadge from './RoleBadge';
import { hasPermission } from '../lib/access';
import NotificationDrawer from './NotificationDrawer';
import ProfileMenu from './ProfileMenu';
import UserProfileDialog from './UserProfileDialog';
import ProfileAvatar from './ProfileAvatar';

function buildNavigation(viewer) {
  const primary = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutGrid, show: true },
    { path: '/dashboard/events', label: 'Events', icon: CalendarDays, show: hasPermission(viewer, 'view_events') },
    { path: '/dashboard/activity', label: 'Activity', icon: Activity, show: hasPermission(viewer, 'view_activity') },
    { path: '/dashboard/strikes', label: 'Strikes', icon: Shield, show: hasPermission(viewer, 'view_self_strikes') || hasPermission(viewer, 'apply_strikes') || hasPermission(viewer, 'issue_strikes') },
    { path: '/dashboard/discord-logs', label: 'Logs', icon: ScrollText, show: hasPermission(viewer, 'view_discord_logs') },
    { path: '/dashboard/logs', label: 'System Logs', icon: FileClock, show: hasPermission(viewer, 'view_logs') },
    { path: '/dashboard/welcome', label: 'Welcome', icon: PartyPopper, show: hasPermission(viewer, 'view_welcome') },
  ].filter((item) => item.show);

  const secondary = [
    { path: '/dashboard/users', label: 'Members', icon: Users2, show: hasPermission(viewer, 'view_users') || hasPermission(viewer, 'manage_web_roles') },
    { path: '/dashboard/autorole', label: 'Settings', icon: Settings2, show: hasPermission(viewer, 'view_autorole') || hasPermission(viewer, 'configure_fam_role') },
  ].filter((item) => item.show);

  return { primary, secondary, all: [...primary, ...secondary] };
}

function getCurrentItem(pathname, navigation) {
  const directMatch = navigation.all.find((item) => item.path === pathname);
  if (directMatch) return directMatch;
  if (pathname === '/dashboard/notifications') return { label: 'Notifications' };
  return navigation.all[0] || { label: 'Dashboard' };
}

function NavigationGroup({ items, location, sidebarCollapsed, closeSidebar }) {
  return (
    <nav className="space-y-2">
      {items.map((item) => {
        const active = item.path === '/dashboard'
          ? location === '/dashboard'
          : location.startsWith(item.path);

        return (
          <Link
            key={item.path}
            to={item.path}
            title={item.label}
            onClick={closeSidebar}
            className={`group flex items-center ${sidebarCollapsed ? 'justify-center px-0' : 'justify-between px-4'} rounded-[22px] border py-3 text-sm font-semibold transition ${active ? 'border-[rgba(49,94,251,0.22)] bg-[var(--primary-soft)] text-[var(--text-main)] shadow-[0_18px_40px_-28px_rgba(49,94,251,0.6)]' : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--bg-soft)] hover:text-[var(--text-main)]'}`}
          >
            <span className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
              <item.icon className={`h-4 w-4 ${active ? 'text-[var(--primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'}`} />
              {!sidebarCollapsed ? item.label : null}
            </span>
            {!sidebarCollapsed ? (
              <ChevronRight className={`h-4 w-4 transition ${active ? 'translate-x-0 text-[var(--primary)]' : '-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100'}`} />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout() {
  const dashboard = useDashboard();
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [profileDialogUser, setProfileDialogUser] = useState(null);
  const [profileDialogLoading, setProfileDialogLoading] = useState(false);
  const handledProfileIntentRef = useRef('');

  const navigation = useMemo(() => buildNavigation(dashboard.viewer), [dashboard.viewer]);
  const currentItem = getCurrentItem(location.pathname, navigation);
  const selfProfile = dashboard.selfProfile || dashboard.myProfile || dashboard.viewer;

  const openProfileDialog = (user = selfProfile) => {
    setProfileDialogLoading(false);
    setProfileDialogUser(user || null);
    setProfileDialogOpen(true);
  };

  useEffect(() => {
    setSidebarOpen(false);
    setNotificationsOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const shouldOpenProfile = location.state?.openProfile === 'me' || params.get('profile') === 'me';
    const intentKey = `${location.key}:${location.pathname}:${location.search}:${location.state?.openProfile || ''}`;

    if (!shouldOpenProfile || !selfProfile || handledProfileIntentRef.current === intentKey) {
      return;
    }

    handledProfileIntentRef.current = intentKey;
    openProfileDialog(selfProfile);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.search, location.state, navigate, selfProfile]);

  if (dashboard.loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="surface-highlight flex w-full max-w-sm flex-col items-center gap-4 rounded-[32px] px-6 py-10 text-center">
          <Spinner className="h-8 w-8 text-[var(--primary)]" />
          <div>
            <p className="text-lg font-semibold text-[var(--text-main)]">Loading dashboard</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Syncing your dashboard data and permissions.</p>
          </div>
        </div>
      </div>
    );
  }

  if (!dashboard.viewer?.primary_role) {
    return <Navigate to="/" replace />;
  }

  const dashboardContextValue = {
    ...dashboard,
    selfProfile,
    openProfileDialog,
    closeProfileDialog: () => setProfileDialogOpen(false),
  };

  return (
    <DashboardContext.Provider value={dashboardContextValue}>
      <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-main)]">
        <button
          type="button"
          onClick={() => setSidebarOpen((current) => !current)}
          className="fixed left-4 top-4 z-[70] flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--bg-panel)]/90 backdrop-blur-lg lg:hidden"
        >
          {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>

        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <aside className={`fixed inset-y-0 left-0 z-[60] flex ${sidebarCollapsed ? 'w-[98px]' : 'w-[286px]'} flex-col border-r border-[var(--border)] bg-[var(--bg-sidebar)]/96 px-4 pb-4 pt-5 backdrop-blur-xl transition-all duration-300 lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[#8ba7ff] text-sm font-black text-white shadow-[0_18px_36px_-18px_rgba(49,94,251,0.9)]">
                IB
              </div>
              {!sidebarCollapsed ? (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.26em] text-[var(--text-muted)]">IND Blades</p>
                  <p className="text-sm text-[var(--text-soft)]">Premium command dashboard</p>
                </div>
              ) : null}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden lg:inline-flex"
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              <ChevronLeft className={`h-4 w-4 transition ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          <div className="mt-6 rounded-[30px] border border-[var(--border)] bg-[var(--bg-soft)] p-4">
            <div className={`flex ${sidebarCollapsed ? 'justify-center' : 'items-center gap-3'}`}>
              <ProfileAvatar
                name={selfProfile?.name || dashboard.viewer.display_name}
                avatarUrl={selfProfile?.avatar_url || dashboard.viewer.avatar_url}
                size="md"
                className="rounded-[18px]"
              />
              {!sidebarCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--text-main)]">{dashboard.viewer.display_name}</p>
                  <div className="mt-2">
                    <RoleBadge role={dashboard.viewer.primary_role} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 flex-1 overflow-y-auto pr-1">
            <NavigationGroup
              items={navigation.primary}
              location={location.pathname}
              sidebarCollapsed={sidebarCollapsed}
              closeSidebar={() => setSidebarOpen(false)}
            />

            {navigation.secondary.length ? (
              <div className="mt-6">
                {!sidebarCollapsed ? (
                  <p className="mb-3 px-3 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
                    Management
                  </p>
                ) : null}
                <NavigationGroup
                  items={navigation.secondary}
                  location={location.pathname}
                  sidebarCollapsed={sidebarCollapsed}
                  closeSidebar={() => setSidebarOpen(false)}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <div className={`rounded-[24px] border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-4 ${sidebarCollapsed ? 'text-center' : ''}`}>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">Bot Status</p>
              <div className={`mt-3 flex items-center gap-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${dashboard.botStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.7)]' : 'bg-rose-400 shadow-[0_0_18px_rgba(251,113,133,0.6)]'}`} />
                {!sidebarCollapsed ? (
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-main)]">{dashboard.botStatus === 'connected' ? 'Online' : 'Offline'}</p>
                    <p className="text-xs text-[var(--text-muted)]">{dashboard.liveSync ? 'Live updates active' : 'Waiting for live sync'}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 px-4 pb-4 pt-4 sm:px-6 lg:px-8">
            <div className="app-shell rounded-[30px] px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="pl-12 lg:pl-0">
                  <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--text-muted)]">{currentItem.label}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-semibold text-[var(--text-main)] sm:text-[2rem]">{dashboard.viewer.display_name}</h1>
                    <RoleBadge role={dashboard.viewer.primary_role} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--text-muted)]">
                    {dashboard.liveSync ? 'Live updates are on across your dashboard.' : 'You are viewing the latest synced data.'}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 text-xs font-semibold text-[var(--text-soft)] md:flex">
                    <span className={`h-2.5 w-2.5 rounded-full ${dashboard.botStatus === 'connected' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                    Bot {dashboard.botStatus === 'connected' ? 'Online' : 'Offline'}
                  </div>

                  <Button
                    variant="secondary"
                    size="icon"
                    className="relative"
                    onClick={() => {
                      setNotificationsOpen((current) => !current);
                      setProfileOpen(false);
                    }}
                    title="Notifications"
                  >
                    <Bell className="h-4 w-4" />
                    {dashboard.unreadNotifications ? (
                      <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--primary)] shadow-[0_0_0_4px_rgba(49,94,251,0.18)]" />
                    ) : null}
                  </Button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileOpen((current) => !current);
                        setNotificationsOpen(false);
                      }}
                      className="flex h-11 items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2.5 pr-3 transition hover:border-[var(--border-strong)]"
                    >
                      <ProfileAvatar
                        name={selfProfile?.name || dashboard.viewer.display_name}
                        avatarUrl={selfProfile?.avatar_url || dashboard.viewer.avatar_url}
                        size="sm"
                        className="rounded-full"
                      />
                      <span className="hidden text-sm font-semibold text-[var(--text-main)] sm:block">
                        {dashboard.viewer.display_name}
                      </span>
                    </button>

                    <ProfileMenu
                      open={profileOpen}
                      onClose={() => setProfileOpen(false)}
                      onMyProfile={() => openProfileDialog(selfProfile)}
                      dashboard={dashboard}
                      theme={theme}
                      toggleTheme={toggle}
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 pb-8 sm:px-6 lg:px-8">
            {dashboard.errorMessage ? (
              <div className="mb-6 rounded-[24px] border border-rose-400/25 bg-rose-500/10 px-5 py-4 text-sm font-medium text-rose-200">
                {dashboard.errorMessage}
              </div>
            ) : null}
            <Outlet />
          </main>
        </div>

        <NotificationDrawer
          open={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          dashboard={dashboard}
        />

        <UserProfileDialog
          open={profileDialogOpen}
          onOpenChange={(open) => {
            setProfileDialogOpen(open);
            if (!open) {
              setProfileDialogLoading(false);
            }
          }}
          user={profileDialogUser}
          loading={profileDialogLoading}
          roles={dashboard.roles}
          roster={dashboard.roster}
          leaderboard={dashboard.leaderboard}
          title={profileDialogUser && String(profileDialogUser.id) === String(selfProfile?.id) ? 'My Profile' : 'User Profile'}
          description="Profile summary, activity, strike history, and roles."
        />
      </div>
    </DashboardContext.Provider>
  );
}
