import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  Bot,
  CalendarDays,
  ChevronLeft,
  FileClock,
  LayoutGrid,
  Menu,
  PartyPopper,
  RefreshCcw,
  ScrollText,
  Settings2,
  Shield,
  Users2,
  X,
} from 'lucide-react';
import { DashboardContext } from '../lib/DashboardContext';
import { cn } from '../lib/cn';
import { useDashboard } from '../hooks/useDashboard';
import { hasPermission } from '../lib/access';
import NotificationDrawer from './NotificationDrawer';
import ProfileAvatar from './ProfileAvatar';
import ProfileMenu from './ProfileMenu';
import RoleBadge from './RoleBadge';
import { useTheme } from './ThemeProvider';
import UserProfileDialog from './UserProfileDialog';
import { Button } from './ui/button';
import { Spinner } from './ui/spinner';

function buildNavigation(viewer) {
  const primary = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutGrid, show: true },
    { path: '/dashboard/events', label: 'Events', icon: CalendarDays, show: hasPermission(viewer, 'view_events') },
    { path: '/dashboard/activity', label: 'Activity', icon: Activity, show: hasPermission(viewer, 'view_activity') },
    {
      path: '/dashboard/strikes',
      label: 'Strikes',
      icon: Shield,
      show:
        hasPermission(viewer, 'view_self_strikes') ||
        hasPermission(viewer, 'apply_strikes') ||
        hasPermission(viewer, 'issue_strikes'),
    },
    { path: '/dashboard/discord-logs', label: 'Logs', icon: ScrollText, show: hasPermission(viewer, 'view_discord_logs') },
    { path: '/dashboard/logs', label: 'System Logs', icon: FileClock, show: hasPermission(viewer, 'view_logs') },
    { path: '/dashboard/welcome', label: 'Welcome', icon: PartyPopper, show: hasPermission(viewer, 'view_welcome') },
  ].filter((item) => item.show);

  const secondary = [
    {
      path: '/dashboard/users',
      label: 'Members',
      icon: Users2,
      show: hasPermission(viewer, 'view_users') || hasPermission(viewer, 'manage_web_roles'),
    },
    {
      path: '/dashboard/autorole',
      label: 'Settings',
      icon: Settings2,
      show: hasPermission(viewer, 'view_autorole') || hasPermission(viewer, 'configure_fam_role'),
    },
    {
      path: '/dashboard/bot-chat',
      label: 'Bot Chat',
      icon: Bot,
      show: hasPermission(viewer, 'manage_bot_chat'),
    },
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
    <nav className="space-y-1.5">
      {items.map((item) => {
        const active = item.path === '/dashboard' ? location === '/dashboard' : location.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            title={item.label}
            onClick={closeSidebar}
            className={cn(
              'group flex items-center rounded-[20px] border px-3 py-3 text-sm font-semibold transition',
              sidebarCollapsed ? 'justify-center' : 'justify-between',
              active
                ? 'border-[rgba(var(--primary-rgb),0.28)] bg-[linear-gradient(135deg,rgba(var(--primary-rgb),0.16),rgba(var(--primary-rgb),0.05))] text-[var(--text-main)] shadow-[0_18px_34px_-26px_rgba(var(--primary-rgb),0.72)]'
                : 'border-transparent bg-transparent text-[var(--text-muted)] hover:border-[var(--border)] hover:bg-[var(--bg-soft)] hover:text-[var(--text-main)]'
            )}
          >
            <span className={cn('flex min-w-0 items-center', sidebarCollapsed ? 'justify-center' : 'gap-3')}>
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-[14px] transition',
                  active
                    ? 'bg-white/10 text-[var(--primary)]'
                    : 'bg-[var(--bg-soft)] text-[var(--text-muted)] group-hover:text-[var(--text-main)]'
                )}
              >
                <item.icon className="h-4 w-4" />
              </span>
              {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout() {
  const dashboard = useDashboard();
  const { theme, toggleTheme } = useTheme();
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
    setProfileOpen(false);
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
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] px-4">
        <div className="surface-highlight flex w-full max-w-sm flex-col items-center gap-4 rounded-[28px] px-6 py-10 text-center">
          <Spinner className="h-9 w-9 text-[var(--primary)]" />
          <div className="space-y-2">
            <p className="text-xl font-semibold text-[var(--text-main)]">Loading Dashboard</p>
            <p className="text-sm leading-7 text-[var(--text-muted)]">Preparing live data, roles, and navigation.</p>
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
      <div className="relative min-h-screen overflow-hidden bg-[var(--bg-main)]">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-[-10%] top-[-18%] h-[480px] w-[480px] rounded-full bg-[linear-gradient(135deg,rgba(var(--primary-rgb),0.22),rgba(99,102,241,0.08))] blur-[140px]" />
          <div className="absolute bottom-[-16%] right-[-4%] h-[420px] w-[420px] rounded-full bg-[linear-gradient(135deg,rgba(56,189,248,0.12),rgba(var(--primary-rgb),0.06))] blur-[150px]" />
        </div>

        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}

        <div className="relative flex min-h-screen">
          <aside
            className={cn(
              'fixed inset-y-4 left-4 z-[60] flex h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[30px] border border-[var(--border)] bg-[var(--bg-sidebar)]/96 shadow-[0_28px_80px_-30px_rgba(2,6,23,0.9)] backdrop-blur-xl transition duration-300 lg:static lg:ml-4 lg:mr-0 lg:translate-x-0',
              sidebarCollapsed ? 'w-24' : 'w-[290px]',
              sidebarOpen ? 'translate-x-0' : '-translate-x-[115%] lg:translate-x-0'
            )}
          >
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,var(--primary),#2448d6)] text-sm font-black text-white shadow-[0_18px_34px_-20px_rgba(var(--primary-rgb),0.95)]">
                  IB
                </div>
                {!sidebarCollapsed ? (
                  <div className="min-w-0">
                    <p className="truncate text-[10px] font-black uppercase tracking-[0.26em] text-[var(--primary)]">IND Blades</p>
                    <p className="truncate text-sm font-semibold text-[var(--text-main)]">Operations Dashboard</p>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="hidden lg:inline-flex"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                >
                  <ChevronLeft className={cn('h-4 w-4 transition', sidebarCollapsed ? 'rotate-180' : '')} />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-5">
              {!sidebarCollapsed ? (
                <div className="surface-soft mb-5 rounded-[24px] p-4">
                  <div className="flex items-center gap-3">
                    <ProfileAvatar
                      name={selfProfile?.name || dashboard.viewer.display_name}
                      avatarUrl={selfProfile?.avatar_url || dashboard.viewer.avatar_url}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--text-main)]">{dashboard.viewer.display_name}</p>
                      <p className="truncate text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">{dashboard.viewer.username}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <RoleBadge role={dashboard.viewer.primary_role} />
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      <span className={cn('h-2 w-2 rounded-full', dashboard.botStatus === 'connected' ? 'bg-emerald-500' : 'bg-rose-500')} />
                      {dashboard.botStatus === 'connected' ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mb-5 flex justify-center">
                  <ProfileAvatar
                    name={selfProfile?.name || dashboard.viewer.display_name}
                    avatarUrl={selfProfile?.avatar_url || dashboard.viewer.avatar_url}
                    size="md"
                  />
                </div>
              )}

              <NavigationGroup
                items={navigation.primary}
                location={location.pathname}
                sidebarCollapsed={sidebarCollapsed}
                closeSidebar={() => setSidebarOpen(false)}
              />

              {navigation.secondary.length ? (
                <div className="mt-7">
                  {!sidebarCollapsed ? (
                    <p className="mb-3 px-1 text-[11px] font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
                      Administration
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

            <div className="border-t border-[var(--border)] px-4 py-4">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((current) => !current);
                    setNotificationsOpen(false);
                  }}
                  className={cn(
                    'w-full rounded-[22px] border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-3 text-left transition hover:border-[var(--border-strong)] hover:bg-white/8',
                    sidebarCollapsed ? 'flex justify-center' : 'flex items-center gap-3'
                  )}
                >
                  <ProfileAvatar
                    name={selfProfile?.name || dashboard.viewer.display_name}
                    avatarUrl={selfProfile?.avatar_url || dashboard.viewer.avatar_url}
                    size="sm"
                  />
                  {!sidebarCollapsed ? (
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--text-main)]">{dashboard.viewer.display_name}</p>
                      <p className="truncate text-xs text-[var(--text-muted)]">Open profile and account actions</p>
                    </div>
                  ) : null}
                </button>

                <ProfileMenu
                  open={profileOpen}
                  onClose={() => setProfileOpen(false)}
                  onMyProfile={() => openProfileDialog(selfProfile)}
                  dashboard={dashboard}
                  theme={theme}
                  toggleTheme={toggleTheme}
                />
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col lg:pl-4">
            <header className="sticky top-0 z-40 px-4 pt-4 lg:px-6">
              <div className="surface flex items-center justify-between rounded-[28px] px-4 py-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="lg:hidden"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.26em] text-[var(--text-muted)]">Workspace</p>
                    <h1 className="truncate text-xl font-semibold text-[var(--text-main)] sm:text-2xl">{currentItem.label}</h1>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3">
                  {dashboard.liveSync ? (
                    <span className="hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] sm:inline-flex">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      Live Sync
                    </span>
                  ) : null}

                  <Button
                    variant="secondary"
                    size="sm"
                    className="hidden sm:inline-flex"
                    onClick={() => dashboard.loadDashboard?.(true)}
                    disabled={dashboard.refreshing}
                  >
                    <RefreshCcw className={cn('h-4 w-4', dashboard.refreshing ? 'animate-spin' : '')} />
                    Refresh
                  </Button>

                  <Button
                    variant="outline"
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
                      <span className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[10px] font-bold text-white shadow-[0_10px_18px_-10px_rgba(var(--primary-rgb),0.95)]">
                        {dashboard.unreadNotifications > 9 ? '9+' : dashboard.unreadNotifications}
                      </span>
                    ) : null}
                  </Button>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto px-4 pb-4 pt-6 sm:px-6 lg:px-6">
              {dashboard.errorMessage ? (
                <div className="mb-6 rounded-[24px] border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">
                  <span className="font-semibold text-rose-200">System Alert:</span> {dashboard.errorMessage}
                </div>
              ) : null}
              <Outlet />
            </main>
          </div>
        </div>

        <NotificationDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} dashboard={dashboard} />

        <UserProfileDialog
          open={profileDialogOpen}
          onOpenChange={(open) => {
            setProfileDialogOpen(open);
            if (!open) setProfileDialogLoading(false);
          }}
          user={profileDialogUser}
          loading={profileDialogLoading}
          roles={dashboard.roles}
          roster={dashboard.roster}
          leaderboard={dashboard.leaderboard}
          title={profileDialogUser && String(profileDialogUser.id) === String(selfProfile?.id) ? 'My Profile' : 'User Record'}
          description="Detailed view of roles, activity, and strike history."
        />
      </div>
    </DashboardContext.Provider>
  );
}
