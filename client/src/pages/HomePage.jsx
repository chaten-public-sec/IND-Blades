import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, Clock3, Lock, ShieldCheck, Sparkles, Trophy, Users2 } from 'lucide-react';
import { api, buildApiUrl } from '../lib/api';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import RoleBadge from '../components/RoleBadge';
import NotificationDrawer from '../components/NotificationDrawer';
import ProfileAvatar from '../components/ProfileAvatar';
import ProfileMenu from '../components/ProfileMenu';
import { useTheme } from '../components/ThemeProvider';

const STATUS_COPY = {
  member_only: 'Only IND Blades members can access this dashboard.',
  oauth_exchange: 'Discord login could not be completed. Please try again.',
  oauth_state: 'The Discord login session expired. Please start again.',
};

function FeatureTile({ icon: Icon, title, description }) {
  return (
    <div className="surface-soft rounded-[24px] p-5">
      <div className="flex h-10 w-10 items-center justify-center rounded-[16px] bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--text-main)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
    </div>
  );
}

function StatTile({ label, value, note }) {
  return (
    <div className="surface-soft rounded-[22px] p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-[var(--text-main)]">{value}</p>
      <p className="mt-2 text-sm text-[var(--text-muted)]">{note}</p>
    </div>
  );
}

function PreviewStack({ viewer, unreadNotifications, hasAccess }) {
  return (
    <div className="relative">
      <div className="surface-highlight relative overflow-hidden rounded-[36px] p-6 shadow-[0_30px_80px_-40px_rgba(37,99,235,0.55)]">
        <div className="absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_top,rgba(91,140,255,0.22),transparent_72%)]" />

        <div className="relative space-y-4">
          <div className="flex items-center justify-between rounded-[24px] border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-4">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                name={viewer?.display_name || 'IND Blades'}
                avatarUrl={viewer?.avatar_url || null}
                size="lg"
              />
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">
                  {viewer?.display_name || 'IND Blades Dashboard'}
                </p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {viewer?.username ? `@${viewer.username}` : 'Discord sign-in and live sync'}
                </p>
              </div>
            </div>
            {viewer?.primary_role ? <RoleBadge role={viewer.primary_role} /> : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatTile
              label="Notifications"
              value={hasAccess ? unreadNotifications : 'Live'}
              note={hasAccess ? 'Unread updates waiting for you' : 'Realtime alerts and live feed'}
            />
            <StatTile
              label="Access"
              value={hasAccess ? 'Ready' : 'Members'}
              note={hasAccess ? 'Dashboard available now' : 'Discord login with role-based access'}
            />
          </div>

          <div className="surface-soft rounded-[28px] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--text-muted)]">Preview</p>
                <h3 className="mt-2 text-xl font-semibold text-[var(--text-main)]">Clean command center</h3>
              </div>
              <div className="rounded-full border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-1 text-xs font-semibold text-[var(--text-soft)]">
                SaaS UI
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex items-center justify-between rounded-[20px] border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">Activity leaderboard</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Weekly messages and voice ranking</p>
                </div>
                <span className="text-sm font-semibold text-[var(--primary)]">Live</span>
              </div>
              <div className="flex items-center justify-between rounded-[20px] border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">Strike workflow</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">Requests, reviews, and direct actions</p>
                </div>
                <span className="text-sm font-semibold text-amber-400">Managed</span>
              </div>
              <div className="flex items-center justify-between rounded-[20px] border border-[var(--border)] bg-[var(--card-bg)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-main)]">Events and logs</p>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">One place for reminders and tracing</p>
                </div>
                <span className="text-sm font-semibold text-emerald-400">Synced</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 rounded-full bg-[var(--primary-soft)] blur-[70px]" />
    </div>
  );
}

export default function HomePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggle } = useTheme();
  const [viewer, setViewer] = useState(null);
  const [notificationCenter, setNotificationCenter] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [memberOnlyDialogOpen, setMemberOnlyDialogOpen] = useState(false);

  const loadHomeData = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    try {
      const sessionResponse = await api.get('/api/auth/session');
      const nextViewer = sessionResponse.data?.viewer || null;
      setViewer(nextViewer);

      if (nextViewer?.primary_role) {
        const notificationsResponse = await api.get('/api/notifications/center');
        setNotificationCenter(Array.isArray(notificationsResponse.data) ? notificationsResponse.data : []);
      } else {
        setNotificationCenter([]);
      }
    } catch {
      setNotificationCenter([]);
      if (!silent) {
        setViewer(null);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadHomeData(false);
  }, []);

  const params = new URLSearchParams(location.search);
  const reason = params.get('reason');
  const message = STATUS_COPY[reason] || '';
  const memberOnlyBlocked = reason === 'member_only';
  const inlineMessage = memberOnlyBlocked ? '' : message;
  const hasAccess = Boolean(viewer?.primary_role);
  const shouldShowNoAccess = memberOnlyBlocked || Boolean(inlineMessage) || (viewer && !hasAccess);
  const unreadNotifications = notificationCenter.filter((item) => !item.read_at).length;

  useEffect(() => {
    setMemberOnlyDialogOpen(memberOnlyBlocked);
  }, [memberOnlyBlocked]);

  const showToast = async (type, messageText, id) => {
    const module = await import('../lib/toast');
    module.showToast(type, messageText, id || `${type}-${messageText}`);
  };

  const handleError = async (error, fallback) => {
    const messageText = error?.response?.data?.error || fallback;
    await showToast('error', messageText, `home-error-${messageText}`);
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      setViewer(null);
      setNotificationCenter([]);
      setNotificationsOpen(false);
      setProfileOpen(false);
      navigate('/', { replace: true });
    }
  };

  const dismissMemberOnlyDialog = () => {
    setMemberOnlyDialogOpen(false);
    navigate('/', { replace: true });
  };

  const homeDashboard = {
    viewer,
    selfProfile: viewer,
    unreadNotifications,
    notificationCenter,
    loadDashboard: async () => {
      await loadHomeData(true);
    },
    handleError,
    showToast,
    logout,
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="floating-soft absolute left-[8%] top-16 h-60 w-60 rounded-full bg-[var(--primary-soft)] blur-[130px]" />
        <div className="floating-soft-delay absolute right-[10%] top-[18%] h-64 w-64 rounded-full bg-[#6d7cff1f] blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="app-shell flex items-center justify-between rounded-full px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[#88a5ff] text-sm font-black text-white">
              IB
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-[var(--text-muted)]">IND Blades</p>
              <p className="text-sm text-[var(--text-soft)]">Operations dashboard</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {hasAccess ? (
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/dashboard">
                  Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : null}

            {hasAccess ? (
              <Button
                variant="secondary"
                size="icon"
                className="relative"
                title="Notifications"
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setProfileOpen(false);
                }}
              >
                <Bell className="h-4 w-4" />
                {unreadNotifications ? (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--primary)] shadow-[0_0_0_4px_rgba(49,94,251,0.18)]" />
                ) : null}
              </Button>
            ) : (
              <Button variant="secondary" size="icon" disabled title="Notifications">
                <Bell className="h-4 w-4" />
              </Button>
            )}

            {!viewer ? (
              <Button
                disabled={loading}
                onClick={() => {
                  window.location.href = buildApiUrl('/api/auth/discord');
                }}
              >
                {loading ? 'Checking' : 'Login'}
              </Button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((current) => !current);
                    setNotificationsOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-2 py-2 transition hover:border-[var(--border-strong)]"
                >
                  <ProfileAvatar
                    name={viewer.display_name}
                    avatarUrl={viewer.avatar_url}
                    size="sm"
                    className="rounded-full"
                  />
                  <div className="hidden items-center gap-2 pr-2 sm:flex">
                    <span className="text-sm font-semibold text-[var(--text-main)]">{viewer.display_name}</span>
                    {viewer.primary_role ? <RoleBadge role={viewer.primary_role} /> : null}
                  </div>
                </button>

                <ProfileMenu
                  open={profileOpen}
                  onClose={() => setProfileOpen(false)}
                  onMyProfile={() => navigate('/dashboard', { state: { openProfile: 'me' } })}
                  dashboard={homeDashboard}
                  theme={theme}
                  toggleTheme={toggle}
                />
              </div>
            )}
          </div>
        </header>

        <section className="grid flex-1 gap-10 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-16">
          <div className="space-y-8">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-[var(--text-muted)]">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              Premium clan operations
            </div>

            <div className="space-y-5">
                <h1 className="max-w-3xl text-5xl font-semibold leading-[0.96] text-[var(--text-main)] sm:text-6xl">
                {memberOnlyBlocked
                  ? 'Access is limited to IND Blades members.'
                  : 'One clean place for events, strikes, activity, logs, and live clan flow.'}
                </h1>
              <p className="max-w-2xl text-base leading-8 text-[var(--text-muted)] sm:text-lg">
                {memberOnlyBlocked
                  ? 'You need to be inside the IND Blades Discord server to continue into the dashboard.'
                  : 'IND Blades members get a focused personal view. Command roles unlock the right controls, live updates, and cleaner workflows without reloads or clutter.'}
              </p>
            </div>

            {inlineMessage || (viewer && !hasAccess) ? (
              <div className="rounded-[26px] border border-amber-400/20 bg-amber-400/10 px-5 py-4 text-sm font-semibold text-amber-100">
                {inlineMessage || 'Only IND Blades members can access this dashboard.'}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
              {hasAccess ? (
                <Button asChild className="h-14 rounded-[22px] px-7 text-base">
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              ) : (
                <Button
                  className="h-14 rounded-[22px] px-8 text-base"
                  disabled={loading}
                  onClick={() => {
                    window.location.href = buildApiUrl('/api/auth/discord');
                  }}
                >
                  {loading ? 'Checking access' : 'Login with Discord'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}

              <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-3 text-sm text-[var(--text-soft)]">
                <Clock3 className="h-4 w-4 text-[var(--primary)]" />
                7-day secure session for members
              </div>
            </div>

            {hasAccess ? (
              <div className="flex flex-wrap items-center gap-3">
                {viewer.primary_role ? <RoleBadge role={viewer.primary_role} /> : null}
                <div className="rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-2 text-sm text-[var(--text-soft)]">
                  {unreadNotifications} unread notification{unreadNotifications === 1 ? '' : 's'}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <FeatureTile
                icon={Bell}
                title="Live notifications"
                description="Realtime updates for strikes, reviews, role changes, and dashboard actions."
              />
              <FeatureTile
                icon={Trophy}
                title="Activity insight"
                description="Weekly leaderboard, message totals, and voice time in a cleaner member view."
              />
              <FeatureTile
                icon={Users2}
                title="Role-based access"
                description="Every person sees only what they should, without a confusing admin-heavy interface."
              />
            </div>
          </div>

          <PreviewStack
            viewer={viewer}
            unreadNotifications={unreadNotifications}
            hasAccess={hasAccess}
          />
        </section>
      </main>

      <NotificationDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        dashboard={homeDashboard}
      />

      <Dialog
        open={memberOnlyDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            dismissMemberOnlyDialog();
            return;
          }
          setMemberOnlyDialogOpen(true);
        }}
      >
        <DialogContent className="w-[min(92vw,460px)]">
          <DialogHeader>
            <DialogTitle>Access Limited</DialogTitle>
            <DialogDescription>IND Blades member check</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="surface-soft rounded-[24px] px-5 py-5 text-sm leading-7 text-[var(--text-muted)]">
              Only IND Blades members can access this dashboard.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={dismissMemberOnlyDialog}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
