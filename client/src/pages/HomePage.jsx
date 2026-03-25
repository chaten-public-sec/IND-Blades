import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Bell, Clock3, Lock, ShieldCheck, Sparkles, Trophy, Users2, Activity, Layers, Zap, Shield, Star, MessageSquare } from 'lucide-react';
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
    <div className="group relative overflow-hidden rounded-[24px] border border-[var(--border)] bg-[var(--bg-panel)] p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[var(--primary)]/10 hover:border-[var(--primary)]/50">
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary)]/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="relative z-10">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--primary)]/10 to-[var(--primary)]/5 text-[var(--primary)] shadow-inner ring-1 ring-[var(--primary)]/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="h-6 w-6" />
        </div>
        <p className="mt-6 text-lg font-bold text-[var(--text-main)]">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)] group-hover:text-[var(--text-soft)] transition-colors">{description}</p>
      </div>
    </div>
  );
}

function StatTile({ label, value, note }) {
  return (
    <div className="group relative overflow-hidden rounded-[24px] border border-[var(--border)] bg-gradient-to-b from-[var(--bg-soft)] to-[var(--bg-panel)] p-5 shadow-sm transition-all duration-300 hover:border-[var(--primary)]/30 hover:shadow-md">
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--primary)]/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
      <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--text-soft)]">{label}</p>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl font-black tracking-tight text-[var(--text-main)] group-hover:text-[var(--primary)] transition-colors">{value}</p>
      </div>
      <p className="mt-2 text-sm font-medium text-[var(--text-muted)]">{note}</p>
    </div>
  );
}

function PreviewStack({ viewer, unreadNotifications, hasAccess }) {
  return (
    <div className="relative w-full max-w-lg lg:max-w-none mx-auto">
      <div className="absolute -inset-1 rounded-[40px] bg-gradient-to-br from-[var(--primary)] via-purple-500 to-indigo-600 opacity-20 blur-2xl transition-all duration-500 hover:opacity-40 hover:blur-3xl" />
      
      <div className="surface-highlight relative overflow-hidden rounded-[36px] border border-[var(--border)] bg-[var(--bg-panel)]/90 p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,rgba(var(--primary-rgb),0.2),transparent_70%)]" />

        <div className="relative space-y-5">
          <div className="flex items-center justify-between rounded-[24px] border border-[var(--border)] bg-[var(--bg-soft)]/60 px-5 py-4 backdrop-blur-md shadow-sm transition-colors hover:bg-[var(--bg-soft)]">
            <div className="flex items-center gap-4">
              <ProfileAvatar
                name={viewer?.display_name || 'IND Blades'}
                avatarUrl={viewer?.avatar_url || null}
                size="lg"
                className="ring-2 ring-[var(--primary)]/30 ring-offset-2 ring-offset-[var(--bg-panel)]"
              />
              <div>
                <p className="text-base font-bold text-[var(--text-main)]">
                  {viewer?.display_name || 'IND Blades Dashboard'}
                </p>
                <p className="mt-0.5 text-sm font-medium text-[var(--text-muted)]">
                  {viewer?.username ? `@${viewer.username}` : 'Discord sign-in and live sync'}
                </p>
              </div>
            </div>
            {viewer?.primary_role ? <RoleBadge role={viewer.primary_role} className="scale-110 shadow-sm" /> : null}
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

          <div className="rounded-[28px] border border-[var(--border)] bg-gradient-to-br from-[var(--bg-soft)] to-[var(--bg-panel)] p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--primary)] flex items-center gap-1.5">
                  <Activity className="h-3 w-3" /> Preview
                </p>
                <h3 className="mt-1 text-xl font-bold tracking-tight text-[var(--text-main)]">Clean command center</h3>
              </div>
              <div className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-panel)] px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-[var(--text-main)] shadow-sm">
                SaaS UI
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {[
                { title: 'Activity leaderboard', desc: 'Weekly messages and voice ranking', status: 'Live', statusColor: 'text-indigo-500', statusBg: 'bg-indigo-500/10 border-indigo-500/20' },
                { title: 'Strike workflow', desc: 'Requests, reviews, and direct actions', status: 'Managed', statusColor: 'text-amber-500', statusBg: 'bg-amber-500/10 border-amber-500/20' },
                { title: 'Events and logs', desc: 'One place for reminders and tracing', status: 'Synced', statusColor: 'text-emerald-500', statusBg: 'bg-emerald-500/10 border-emerald-500/20' }
              ].map((item, i) => (
                <div key={i} className="group flex items-center justify-between rounded-[20px] border border-[var(--border)] bg-[var(--card-bg)] px-5 py-4 transition-all hover:border-[var(--primary)]/40 hover:shadow-md hover:-translate-y-0.5">
                  <div>
                    <p className="text-sm font-bold text-[var(--text-main)] transition-colors group-hover:text-[var(--text-main)]">{item.title}</p>
                    <p className="mt-1 text-sm font-medium text-[var(--text-muted)]">{item.desc}</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${item.statusColor} ${item.statusBg} shadow-sm`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
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
    setNotificationCenter,
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--bg-main)] selection:bg-[var(--primary)]/30 selection:text-[var(--text-main)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="floating-soft absolute left-[-10%] top-[-10%] h-[800px] w-[800px] rounded-full bg-gradient-to-br from-[var(--primary)]/20 to-purple-500/10 blur-[150px]" />
        <div className="floating-soft-delay absolute right-[-5%] top-[10%] h-[600px] w-[600px] rounded-full bg-gradient-to-bl from-indigo-500/15 to-blue-500/10 blur-[150px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--primary)]/30 to-transparent opacity-50" />
      </div>

      <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="app-shell sticky top-4 z-40 flex items-center justify-between rounded-full border border-[var(--border)] bg-[var(--bg-panel)]/80 px-4 py-3 backdrop-blur-xl shadow-lg shadow-black/5 sm:px-5 transition-all">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br from-[var(--primary)] to-indigo-600 text-sm font-black text-white shadow-lg shadow-[var(--primary)]/30 ring-1 ring-white/20">
              IB
            </div>
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-[var(--primary)]">IND Blades</p>
              <p className="text-sm font-semibold text-[var(--text-main)]">Operations Center</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {hasAccess ? (
              <Button asChild variant="ghost" className="hidden sm:inline-flex font-semibold hover:bg-[var(--bg-soft)] rounded-full px-5">
                <Link to="/dashboard">
                  Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            ) : null}

            {hasAccess ? (
              <Button
                variant="outline"
                size="icon"
                className="relative rounded-full border-[var(--border)] bg-[var(--bg-panel)] hover:bg-[var(--bg-soft)] shadow-sm hover:border-[var(--primary)]/50 transition-colors"
                title="Notifications"
                onClick={() => {
                  setNotificationsOpen((current) => !current);
                  setProfileOpen(false);
                }}
              >
                <Bell className="h-5 w-5 text-[var(--text-main)]" />
                {unreadNotifications ? (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] ring-2 ring-[var(--bg-panel)] animate-pulse" />
                ) : null}
              </Button>
            ) : (
              <Button variant="outline" size="icon" disabled title="Notifications" className="rounded-full border-[var(--border)] bg-[var(--bg-panel)]/50">
                <Bell className="h-5 w-5 opacity-40" />
              </Button>
            )}

            {viewer ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((current) => !current);
                    setNotificationsOpen(false);
                  }}
                  className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--bg-soft)]/50 p-1.5 pr-4 transition-all hover:border-[var(--primary)]/40 hover:bg-[var(--bg-soft)] hover:shadow-md"
                >
                  <ProfileAvatar
                    name={viewer.display_name}
                    avatarUrl={viewer.avatar_url}
                    size="sm"
                    className="rounded-full ring-2 ring-[var(--border)]"
                  />
                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="text-sm font-bold text-[var(--text-main)]">{viewer.display_name}</span>
                    {viewer.primary_role ? <RoleBadge role={viewer.primary_role} className="scale-90 origin-left" /> : null}
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
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-soft)]/50 shadow-inner">
                <ProfileAvatar name="Guest" avatarUrl={null} size="sm" className="rounded-full opacity-50" />
              </div>
            )}
          </div>
        </header>

        <section className="grid gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-24 border-b border-[var(--border)]/50">
          <div className="space-y-10">
            <div className="inline-flex w-fit items-center gap-2.5 rounded-full border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-[var(--primary)] shadow-[0_0_30px_rgba(var(--primary-rgb),0.15)] ring-1 ring-[var(--primary)]/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Sparkles className="h-4 w-4" />
              Elite Clan Infrastructure
            </div>

            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
              <h1 className="max-w-3xl text-5xl font-black tracking-tight leading-[1.05] text-transparent bg-clip-text bg-gradient-to-br from-[var(--text-main)] via-[var(--text-main)] to-[var(--text-muted)] sm:text-6xl lg:text-[4.5rem]">
                {memberOnlyBlocked
                  ? 'Access is limited to IND Blades members.'
                  : 'Command your clan operations with clarity.'}
              </h1>
              <p className="max-w-2xl text-lg font-medium leading-relaxed text-[var(--text-muted)] sm:text-xl">
                {memberOnlyBlocked
                  ? 'You need to be inside the IND Blades Discord server to continue into the dashboard.'
                  : 'IND Blades members get a focused personal view. Command roles unlock the right controls, live updates, and cleaner workflows without reloads or clutter.'}
              </p>
            </div>

            {inlineMessage || (viewer && !hasAccess) ? (
              <div className="flex items-center gap-4 rounded-[24px] border border-amber-500/30 bg-amber-500/10 px-6 py-5 text-sm font-bold text-amber-600 dark:text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)] animate-in fade-in duration-500">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20">
                  <Lock className="h-5 w-5 flex-shrink-0" />
                </div>
                {inlineMessage || 'Only IND Blades members can access this dashboard.'}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-5 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              {hasAccess ? (
                <Button asChild className="h-14 rounded-full bg-[var(--primary)] px-9 text-base font-bold text-white shadow-xl shadow-[var(--primary)]/25 transition-all hover:-translate-y-1 hover:bg-[var(--primary)] hover:shadow-[var(--primary)]/40">
                  <Link to="/dashboard">
                    Go to Dashboard
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <Button
                  className="h-14 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white px-9 text-base font-bold shadow-xl shadow-[#5865F2]/30 transition-all hover:-translate-y-1 hover:shadow-[#5865F2]/50 border border-[#5865F2]/50"
                  disabled={loading}
                  onClick={() => {
                    window.location.href = buildApiUrl('/api/auth/discord');
                  }}
                >
                  <svg className="mr-3 h-6 w-6 fill-current" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77.7,77.7,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.3,46,96.19,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                  {loading ? 'Connecting...' : 'Login with Discord'}
                </Button>
              )}

              <div className="flex items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--bg-panel)]/60 px-6 py-3.5 text-sm font-bold text-[var(--text-main)] shadow-sm backdrop-blur-md">
                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                Secure OAuth2 Session
              </div>
            </div>

            {hasAccess ? (
              <div className="flex flex-wrap items-center gap-4 pt-2 animate-in fade-in duration-700 delay-300">
                {viewer.primary_role ? <RoleBadge role={viewer.primary_role} className="scale-110 shadow-md" /> : null}
                <div className="rounded-full border border-[var(--border-strong)] bg-[var(--bg-panel)] px-6 py-2.5 text-sm font-bold text-[var(--text-main)] shadow-sm">
                  <span className="text-[var(--primary)] text-base mr-1">{unreadNotifications}</span> 
                  unread notification{unreadNotifications === 1 ? '' : 's'}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-center lg:justify-end animate-in fade-in zoom-in-95 duration-1000">
            <PreviewStack
              viewer={viewer}
              unreadNotifications={unreadNotifications}
              hasAccess={hasAccess}
            />
          </div>
        </section>

        <section className="py-24 relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,var(--primary-soft)_0%,transparent_60%)] opacity-10 pointer-events-none blur-3xl" />
          
          <div className="relative z-10 text-center max-w-3xl mx-auto space-y-6 mb-16">
            <h2 className="text-4xl font-black text-[var(--text-main)] tracking-tight">Everything you need to scale</h2>
            <p className="text-[var(--text-muted)] text-xl font-medium">Powerful, intuitive features designed specifically to streamline clan management and member engagement.</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 relative z-10">
            <FeatureTile
              icon={Zap}
              title="Real-time Synchronization"
              description="Actions taken in the dashboard instantly reflect in your Discord server and vice versa. No refreshing required."
            />
            <FeatureTile
              icon={Shield}
              title="Role-Based Security"
              description="Granular permissions ensure members only see what they have access to. Leaders get complete command."
            />
            <FeatureTile
              icon={Trophy}
              title="Activity Tracking"
              description="Automated leaderboards for messages, voice time, and participation. Reward your most active members."
            />
            <FeatureTile
              icon={Layers}
              title="Strike Workflows"
              description="Manage warnings, kicks, and appeals through a clean UI instead of messy Discord channels."
            />
            <FeatureTile
              icon={MessageSquare}
              title="Log Aggregation"
              description="A single source of truth for all clan events, role changes, and administrative actions."
            />
            <FeatureTile
              icon={Star}
              title="Event Management"
              description="Schedule raids, meetings, and casual games with automated reminders and RSVP tracking."
            />
          </div>
        </section>

        {!hasAccess && (
          <section className="py-20 mb-10 mt-10 rounded-[40px] border border-[var(--border)] bg-gradient-to-b from-[var(--bg-panel)] to-[var(--bg-soft)] text-center relative overflow-hidden shadow-2xl">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
            <div className="absolute left-1/2 top-0 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--primary)] to-transparent opacity-50" />
            
            <div className="relative z-10 max-w-2xl mx-auto px-6 space-y-8">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[24px] bg-gradient-to-br from-[#5865F2] to-indigo-600 shadow-xl shadow-[#5865F2]/20">
                <Users2 className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-4xl font-black text-[var(--text-main)]">Ready to deploy?</h2>
              <p className="text-xl text-[var(--text-muted)] font-medium">Join the ranks and gain immediate access to your personalized command center.</p>
              
              <div className="pt-4">
                <Button
                  className="h-16 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white px-10 text-lg font-bold shadow-2xl shadow-[#5865F2]/30 transition-all hover:-translate-y-1 hover:shadow-[#5865F2]/50 border border-[#5865F2]/50"
                  disabled={loading}
                  onClick={() => {
                    window.location.href = buildApiUrl('/api/auth/discord');
                  }}
                >
                  <svg className="mr-3 h-7 w-7 fill-current" viewBox="0 0 127.14 96.36">
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77.7,77.7,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.31,60,73.31,53s5-12.74,11.43-12.74S96.3,46,96.19,53,91.08,65.69,84.69,65.69Z" />
                  </svg>
                  {loading ? 'Connecting...' : 'Authenticate with Discord'}
                </Button>
              </div>
            </div>
          </section>
        )}
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
        <DialogContent className="w-[min(92vw,460px)] border-[var(--border-strong)] bg-[var(--bg-panel)] shadow-2xl rounded-[32px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[var(--text-main)]">Access Limited</DialogTitle>
            <DialogDescription className="font-medium">IND Blades member check</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 px-6 py-5 text-sm font-medium leading-relaxed text-red-600 dark:text-red-400">
              Only IND Blades members can access this dashboard.
            </div>
          </DialogBody>
          <DialogFooter>
            <Button onClick={dismissMemberOnlyDialog} className="w-full rounded-full font-bold sm:w-auto hover:scale-105 transition-transform">
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}