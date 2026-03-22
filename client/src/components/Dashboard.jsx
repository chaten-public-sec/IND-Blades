import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Gauge,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  Users
} from 'lucide-react';
import heroImage from '../assets/hero.png';
import { cn } from '../lib/cn';
import { api, createRealtimeClient } from '../lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { SelectField } from './ui/select';
import { Skeleton } from './ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from './ui/table';
import { TimeInput } from './ui/time-input';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'welcome', label: 'Welcome', icon: Sparkles },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'activity', label: 'Activity', icon: TrendingUp },
  { id: 'logs', label: 'Logs', icon: FileText }
];

const emptyEventForm = {
  id: '',
  name: '',
  time: '19:00',
  daily: false,
  mode: 'server',
  targetType: 'channel',
  targetId: '',
  mentionRoleId: '',
  enabled: true
};

function formatDuration(seconds) {
  const total = Number(seconds || 0);
  if (!total) return '0m';
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDate(value) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleString();
}

function score(user) {
  return Math.floor(Number(user.voice_time || 0) / 60) * 2 + Number(user.messages || 0);
}

function userLabel(user) {
  return user?.name || user?.global_name || user?.username || (user?.id ? `User ${String(user.id).slice(-4)}` : 'Unknown user');
}

function buildEventForm(event) {
  if (!event) return { ...emptyEventForm };
  return {
    id: event.id || '',
    name: event.desc || '',
    time: event.time || '19:00',
    daily: Boolean(event.daily),
    mode: event.delivery_mode === 'dm' ? 'dm' : 'server',
    targetType: event.target_type || (event.delivery_mode === 'dm' ? 'user' : 'channel'),
    targetId: event.target_id || event.creator_id || event.channel_id || '',
    mentionRoleId: event.mention_role_id || '',
    enabled: Boolean(event.enabled)
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState(null);
  const [health, setHealth] = useState({});
  const [ping, setPing] = useState(-1);
  const [liveSync, setLiveSync] = useState(false);
  const [events, setEvents] = useState([]);
  const [welcome, setWelcome] = useState({ enabled: true, channel_id: '' });
  const [welcomeChannelDraft, setWelcomeChannelDraft] = useState('');
  const [welcomeSaving, setWelcomeSaving] = useState(false);
  const [previewingWelcome, setPreviewingWelcome] = useState(false);
  const [logSettingsDraft, setLogSettingsDraft] = useState({ enabled: true, moderation_channel_id: '', event_channel_id: '', system_channel_id: '' });
  const [savingLogs, setSavingLogs] = useState(false);
  const [activityStats, setActivityStats] = useState({ users: {}, last_reset: 0 });
  const [resettingWeek, setResettingWeek] = useState(false);
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [eventSearch, setEventSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [logSearch, setLogSearch] = useState('');
  const [logSource, setLogSource] = useState('all');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [eventForm, setEventForm] = useState({ ...emptyEventForm });
  const [eventSearchUsers, setEventSearchUsers] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteEvent, setDeleteEvent] = useState(null);

  const channelMap = new Map(channels.map((item) => [String(item.id), item.name]));
  const roleMap = new Map(roles.map((item) => [String(item.id), item.name]));
  const rosterMap = new Map(users.map((item) => [String(item.id), { ...item, roles: Array.isArray(item.roles) ? item.roles.map(String) : [], voice_time: Number(item.voice_time || 0), messages: Number(item.messages || 0) }]));
  Object.entries(activityStats.users || {}).forEach(([id, stats]) => {
    const current = rosterMap.get(String(id)) || { id: String(id), name: `User ${String(id).slice(-4)}`, roles: [], voice_time: 0, messages: 0 };
    rosterMap.set(String(id), { ...current, voice_time: Number(stats.voice_time || current.voice_time || 0), messages: Number(stats.messages || current.messages || 0) });
  });
  const roster = Array.from(rosterMap.values()).sort((left, right) => userLabel(left).localeCompare(userLabel(right)));
  const userMap = new Map(roster.map((item) => [String(item.id), item]));

  function showToast(message, tone = 'success') {
    setToast({ message, tone });
    window.setTimeout(() => setToast((current) => (current?.message === message ? null : current)), 3000);
  }

  function targetLabel(event) {
    if (event.target_type === 'channel') return channelMap.get(String(event.target_id || event.channel_id || '')) || 'Unknown channel';
    if (event.target_type === 'role') return roleMap.get(String(event.target_id || '')) || 'Unknown role';
    return userLabel(userMap.get(String(event.target_id || event.creator_id || '')));
  }

  function syncPayload(payload, pingPayload) {
    setHealth(payload.health || pingPayload?.data || {});
    setEvents(Array.isArray(payload.events) ? payload.events : []);
    setWelcome(payload.welcome || { enabled: true, channel_id: '' });
    setWelcomeChannelDraft(payload.welcome?.channel_id || '');
    setLogSettingsDraft(payload.log_settings || { enabled: true, moderation_channel_id: '', event_channel_id: '', system_channel_id: '' });
    setActivityStats(payload.activity || { users: {}, last_reset: 0 });
    setLogs(Array.isArray(payload.logs) ? payload.logs : []);
    setUsers(Array.isArray(payload.users) ? payload.users : []);
    setChannels(Array.isArray(payload.channels) ? payload.channels : []);
    setRoles(Array.isArray(payload.roles) ? payload.roles : []);
    setPing(pingPayload ? pingPayload.ping : -1);
    setErrorMessage('');
  }

  async function loadDashboard(silent = false) {
    if (silent) setRefreshing(true); else setLoading(true);
    try {
      const pingRequest = (async () => {
        try {
          const startedAt = performance.now();
          const response = await api.get('/api/test');
          return { data: response.data || {}, ping: Math.round(performance.now() - startedAt) };
        } catch {
          return null;
        }
      })();
      const [bootstrapResponse, pingPayload] = await Promise.all([api.get('/api/dashboard/bootstrap'), pingRequest]);
      syncPayload(bootstrapResponse.data || {}, pingPayload);
      return true;
    } catch (error) {
      if (error.response?.status === 401) {
        navigate('/login', { replace: true });
        return false;
      }
      setErrorMessage(error.response?.data?.error || 'Unable to load data.');
      return false;
    } finally {
      if (silent) setRefreshing(false); else setLoading(false);
    }
  }

  function handleError(error, fallback) {
    if (error.response?.status === 401) {
      navigate('/login', { replace: true });
      return;
    }
    const message = error.response?.data?.error || fallback;
    setErrorMessage(message);
    showToast(message, 'error');
  }

  useEffect(() => {
    let active = true;
    let socket = null;
    let intervalId = null;
    const start = async () => {
      const ready = await loadDashboard(false);
      if (!active || !ready) return;
      socket = createRealtimeClient();
      socket.on('connect', () => active && setLiveSync(true));
      socket.on('disconnect', () => active && setLiveSync(false));
      socket.on('connect_error', () => active && setLiveSync(false));
      ['eventsUpdated', 'welcomeUpdated', 'statsUpdated', 'logSettingsUpdated', 'logsUpdated'].forEach((name) => {
        socket.on(name, () => active && loadDashboard(true));
      });
      socket.connect();
      intervalId = window.setInterval(() => active && loadDashboard(true), 30000);
    };
    start();
    return () => {
      active = false;
      if (intervalId) window.clearInterval(intervalId);
      if (socket) socket.disconnect();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[280px,1fr]">
          <Card className="h-[calc(100vh-3rem)] min-h-[760px] p-6">
            <Skeleton className="h-full rounded-[28px]" />
          </Card>
          <div className="space-y-6">
            <Card className="p-6"><Skeleton className="h-32 rounded-[28px]" /></Card>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Card key={index} className="p-6"><Skeleton className="h-28 rounded-[24px]" /></Card>)}</div>
            <Card className="p-6"><Skeleton className="h-[420px] rounded-[28px]" /></Card>
          </div>
        </div>
      </div>
    );
  }

  const filteredEvents = events.filter((item) => `${item.desc} ${targetLabel(item)}`.toLowerCase().includes(eventSearch.trim().toLowerCase()));
  const filteredUsers = roster.filter((item) => `${userLabel(item)} ${item.username || ''}`.toLowerCase().includes(userSearch.trim().toLowerCase()));
  const filteredLogs = logs.filter((item) => {
    const query = logSearch.trim().toLowerCase();
    const matchesSource = logSource === 'all' || String(item.source || '') === logSource;
    return matchesSource && (!query || `${item.message || ''} ${item.source || ''}`.toLowerCase().includes(query));
  });
  const leaderboard = [...roster].sort((left, right) => score(right) - score(left)).slice(0, 10);
  const firstChannelId = channels[0]?.id || '';
  const firstRoleId = roles[0]?.id || '';
  const firstUserId = roster[0]?.id || '';

  function updateEventField(field, value) {
    setEventForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'mode') {
        if (value === 'server' && current.targetType === 'user') {
          next.targetType = firstChannelId ? 'channel' : 'role';
          next.targetId = firstChannelId || firstRoleId || '';
        }
        if (value === 'dm' && current.targetType === 'channel') {
          next.targetType = firstUserId ? 'user' : 'role';
          next.targetId = firstUserId || firstRoleId || '';
        }
      }
      if (field === 'targetType') {
        next.mode = value === 'channel' ? 'server' : value === 'user' ? 'dm' : current.mode;
        next.targetId = value === 'channel' ? firstChannelId : value === 'role' ? firstRoleId : firstUserId;
      }
      return next;
    });
  }

  async function saveEvent() {
    if (!eventForm.name.trim()) return showToast('Event name is required.', 'error');
    if (!/^\d{2}:\d{2}$/.test(eventForm.time)) return showToast('Time must use HH:MM format.', 'error');
    if (!String(eventForm.targetId || '').trim()) return showToast('Choose where this event should go.', 'error');
    setSavingEvent(true);
    try {
      const payload = {
        id: eventForm.id || undefined,
        name: eventForm.name.trim(),
        time: eventForm.time.trim(),
        daily: eventForm.daily,
        mode: eventForm.mode,
        target_type: eventForm.targetType,
        target_id: String(eventForm.targetId).trim(),
        enabled: eventForm.enabled,
        mention_role_id: eventForm.mode === 'server' && eventForm.targetType === 'channel' ? String(eventForm.mentionRoleId || '').trim() || null : null
      };
      await api.post(eventForm.id ? '/api/events/update' : '/api/events/create', payload);
      setEventDialogOpen(false);
      showToast(eventForm.id ? 'Updated' : 'Saved');
      await loadDashboard(true);
    } catch (error) {
      handleError(error, 'Unable to save the event.');
    } finally {
      setSavingEvent(false);
    }
  }

  async function quickAction(task) {
    try {
      await task();
      await loadDashboard(true);
    } catch (error) {
      handleError(error, 'Something went wrong.');
    }
  }

  const stats = [
    { label: 'Total Users', value: roster.length, meta: 'Visible in the dashboard', icon: Users },
    { label: 'Active Users', value: roster.filter((item) => item.messages || item.voice_time).length, meta: 'Messages or voice this week', icon: Activity },
    { label: 'Events', value: events.filter((item) => item.enabled).length, meta: `${events.length} total scheduled`, icon: CalendarDays },
    { label: 'System Status', value: ping >= 0 ? 'Online' : 'Offline', meta: ping >= 0 ? `${ping}ms response time` : 'Check the API connection', icon: Gauge }
  ];

  return (
    <>
      <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[280px,1fr]">
          <aside className="surface sticky top-6 h-fit max-h-[calc(100vh-3rem)] overflow-hidden rounded-[30px] p-5">
            <div className="space-y-4">
              <div className="rounded-[26px] border border-white/10 bg-white/6 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">IND Blades</p>
                <p className="mt-2 text-2xl font-semibold text-white">Control Room</p>
                <p className="mt-2 text-sm leading-7 text-slate-400">A cleaner product shell for the same live bot system.</p>
              </div>
              <div className="space-y-2 overflow-y-auto pr-1">{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setActiveTab(item.id)} className={cn('flex w-full items-center gap-3 rounded-[22px] px-4 py-3 text-left text-sm font-semibold transition', activeTab === item.id ? 'bg-cyan-300/12 text-white' : 'text-slate-400 hover:bg-white/6 hover:text-white')}><div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6"><Icon className="h-4 w-4" /></div>{item.label}</button>; })}</div>
              <Button variant="secondary" className="mt-4 w-full" onClick={async () => { try { await api.post('/api/logout'); } finally { navigate('/login', { replace: true }); } }}>
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
            </div>
          </aside>

          <main className="space-y-6">
            <Card>
              <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="neutral">IND Blades</Badge>
                    <Badge variant={ping >= 0 ? 'success' : 'danger'}>{ping >= 0 ? 'API Online' : 'API Offline'}</Badge>
                    <Badge variant={liveSync ? 'success' : 'warning'}>{liveSync ? 'Real-Time Ready' : 'Syncing'}</Badge>
                    {refreshing ? <span className="inline-flex items-center gap-2 text-sm text-slate-400"><LoaderCircle className="h-4 w-4 animate-spin" />Refreshing</span> : null}
                  </div>
                  <p className="mt-3 text-sm uppercase tracking-[0.24em] text-slate-500">Premium dashboard</p>
                  <h1 className="text-4xl font-semibold text-white">IND Blades</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">Everything feels cleaner now, but the live routes and sync flow stay intact.</p>
                </div>
                <Button variant="outline" onClick={() => loadDashboard(true)}><RefreshCcw className="h-4 w-4" />Refresh</Button>
              </CardContent>
            </Card>

            {errorMessage ? <div className="rounded-[24px] border border-rose-300/20 bg-rose-300/10 px-5 py-4 text-sm font-medium text-rose-100">{errorMessage}</div> : null}

            {activeTab === 'dashboard' ? <div className="space-y-6"><Card className="overflow-hidden"><div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]"><div className="space-y-4 p-6 sm:p-8"><p className="text-sm uppercase tracking-[0.24em] text-slate-500">Operations overview</p><h2 className="text-4xl font-semibold text-white">Run the whole community from one polished surface.</h2><p className="max-w-2xl text-sm leading-7 text-slate-400">Events, welcome flows, activity, logs, and live sync are all aligned inside one consistent Tailwind shell.</p></div><div className="relative min-h-[260px] overflow-hidden border-t border-white/10 lg:border-l lg:border-t-0"><img src={heroImage} alt="IND Blades" className="h-full w-full object-cover opacity-75" /><div className="absolute inset-0 bg-gradient-to-br from-slate-950/15 via-slate-950/35 to-slate-950/85" /></div></div></Card><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{stats.map((item) => { const Icon = item.icon; return <Card key={item.label}><CardContent className="flex items-start justify-between gap-4 p-6"><div><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{item.label}</p><p className="mt-3 text-3xl font-semibold text-white">{item.value}</p><p className="mt-2 text-sm text-slate-400">{item.meta}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-cyan-100"><Icon className="h-5 w-5" /></div></CardContent></Card>; })}</div></div> : null}

            {activeTab === 'events' ? <div className="space-y-6"><Card><CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm uppercase tracking-[0.24em] text-slate-500">Events</p><h2 className="text-3xl font-semibold text-white">Smooth event control</h2></div><div className="flex flex-col gap-3 sm:flex-row"><div className="relative min-w-[240px]"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} placeholder="Search events" className="surface-soft h-11 w-full rounded-2xl pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500" /></div><Button onClick={() => { setEventForm({ ...emptyEventForm, targetId: firstChannelId || firstRoleId || firstUserId, mentionRoleId: firstRoleId || '' }); setEventDialogOpen(true); }}><Plus className="h-4 w-4" />Create Event</Button></div></CardContent></Card><Card><CardHeader><CardTitle>Event list</CardTitle><CardDescription>Everything here stays in sync with the bot.</CardDescription></CardHeader><CardContent>{filteredEvents.length ? <Table><TableHead><tr><TableHeaderCell>Event</TableHeaderCell><TableHeaderCell>Schedule</TableHeaderCell><TableHeaderCell>Target</TableHeaderCell><TableHeaderCell>Status</TableHeaderCell><TableHeaderCell className="text-right">Actions</TableHeaderCell></tr></TableHead><TableBody>{filteredEvents.map((item) => <TableRow key={item.id}><TableCell><button onClick={() => setSelectedEvent(item)} className="text-left font-semibold text-white transition hover:text-cyan-100">{item.desc}<div className="mt-1 text-sm text-slate-400">{item.delivery_mode === 'dm' ? 'DM' : 'Server'} • {item.daily ? 'Daily' : 'One time'}</div></button></TableCell><TableCell>{item.time}</TableCell><TableCell>{targetLabel(item)}</TableCell><TableCell><Badge variant={item.enabled ? 'success' : 'danger'}>{item.enabled ? 'On' : 'Off'}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setSelectedEvent(item)}><Eye className="h-4 w-4" />View</Button><Button variant="ghost" size="sm" onClick={() => { setEventForm(buildEventForm(item)); setEventDialogOpen(true); }}><Pencil className="h-4 w-4" />Edit</Button><Button variant="ghost" size="sm" onClick={() => quickAction(() => api.post('/api/events/toggle', { id: item.id, enabled: !item.enabled }))}>{item.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{item.enabled ? 'Turn Off' : 'Turn On'}</Button><Button variant="ghost" size="sm" className="text-rose-200 hover:bg-rose-300/10 hover:text-rose-100" onClick={() => setDeleteEvent(item)}><Trash2 className="h-4 w-4" />Delete</Button></div></TableCell></TableRow>)}</TableBody></Table> : <div className="rounded-[24px] border border-white/10 bg-white/4 p-8 text-center text-slate-400">No events found.</div>}</CardContent></Card></div> : null}

            {activeTab === 'welcome' ? <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]"><Card><CardHeader><CardTitle>Welcome settings</CardTitle><CardDescription>Choose the channel and preview the same embed style members will get.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="surface-soft flex items-center justify-between gap-4 rounded-[26px] p-5"><div><p className="text-sm font-semibold text-white">Welcome system</p><p className="mt-1 text-sm text-slate-400">Turn the welcome flow on or off.</p></div><Button variant={welcome.enabled ? 'secondary' : 'default'} loading={welcomeSaving} onClick={async () => { setWelcomeSaving(true); try { const response = await api.post('/api/welcome/toggle', { enabled: !welcome.enabled }); setWelcome(response.data?.config || welcome); setWelcomeChannelDraft(response.data?.config?.channel_id || welcomeChannelDraft); showToast(response.data?.config?.enabled ? 'Turned on' : 'Turned off'); } catch (error) { handleError(error, 'Unable to update welcome settings.'); } finally { setWelcomeSaving(false); } }}>{welcome.enabled ? 'Turn Off' : 'Turn On'}</Button></div><div className="space-y-2"><label className="text-sm font-semibold text-slate-200">Welcome channel</label><SelectField value={welcomeChannelDraft} onChange={(event) => setWelcomeChannelDraft(event.target.value)}><option value="">Choose a channel</option>{channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField></div><div className="flex flex-col gap-3 sm:flex-row"><Button variant="secondary" loading={welcomeSaving} onClick={async () => { setWelcomeSaving(true); try { const response = await api.post('/api/welcome/channel', { channel_id: String(welcomeChannelDraft || '').trim() || null }); setWelcome(response.data?.config || welcome); setWelcomeChannelDraft(response.data?.config?.channel_id || welcomeChannelDraft); showToast('Saved'); } catch (error) { handleError(error, 'Unable to save the welcome channel.'); } finally { setWelcomeSaving(false); } }}>Save</Button><Button variant="outline" loading={previewingWelcome} onClick={async () => { setPreviewingWelcome(true); try { if (welcomeChannelDraft !== (welcome.channel_id || '')) { await api.post('/api/welcome/channel', { channel_id: String(welcomeChannelDraft || '').trim() || null }); } await api.post('/api/welcome/preview'); showToast('Preview sent'); } catch (error) { handleError(error, 'Unable to send the welcome preview.'); } finally { setPreviewingWelcome(false); } }}><Send className="h-4 w-4" />Preview Welcome</Button></div></CardContent></Card><Card className="overflow-hidden"><div className="relative h-52 overflow-hidden border-b border-white/10"><img src={heroImage} alt="Welcome preview" className="h-full w-full object-cover opacity-70" /><div className="absolute inset-0 bg-gradient-to-br from-slate-950/20 via-slate-950/40 to-slate-950/85" /></div><CardContent className="space-y-4 p-6 text-sm leading-7 text-slate-300"><p className="font-semibold text-cyan-100">━━━━━━━━━━━━━━━━━━</p><p className="text-lg font-semibold text-white">Welcome to IND Blades</p><p className="font-semibold text-cyan-100">━━━━━━━━━━━━━━━━━━</p><p>Hello New Member,</p><p>Welcome to <span className="font-semibold text-white">IND Blades Family</span> ⚔️</p><p>⚡ Check out the channels and introduce yourself.</p><p>📌 Make sure to read the rules and have fun.</p><p className="text-xs uppercase tracking-[0.24em] text-slate-500">Preview channel: {channelMap.get(String(welcomeChannelDraft || welcome.channel_id || '')) || 'Choose a channel'}</p></CardContent></Card></div> : null}
            {activeTab === 'users' ? <Card><CardHeader><CardTitle>Member directory</CardTitle><CardDescription>Search by name and open a focused user view.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="relative max-w-sm"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users" className="surface-soft h-11 w-full rounded-2xl pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500" /></div>{filteredUsers.length ? <Table><TableHead><tr><TableHeaderCell>User</TableHeaderCell><TableHeaderCell>Roles</TableHeaderCell><TableHeaderCell>Voice Time</TableHeaderCell><TableHeaderCell>Messages</TableHeaderCell><TableHeaderCell className="text-right">View</TableHeaderCell></tr></TableHead><TableBody>{filteredUsers.map((item) => <TableRow key={item.id}><TableCell><div className="font-semibold text-white">{userLabel(item)}</div><div className="text-sm text-slate-400">{item.username ? `@${item.username}` : 'Member profile'}</div></TableCell><TableCell>{item.roles?.length ? item.roles.slice(0, 3).map((roleId) => roleMap.get(String(roleId)) || 'Role').join(', ') : 'No roles'}</TableCell><TableCell>{formatDuration(item.voice_time)}</TableCell><TableCell>{item.messages}</TableCell><TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => setSelectedUser(item)}><Eye className="h-4 w-4" />View</Button></TableCell></TableRow>)}</TableBody></Table> : <div className="rounded-[24px] border border-white/10 bg-white/4 p-8 text-center text-slate-400">No users found.</div>}</CardContent></Card> : null}
            {activeTab === 'activity' ? <div className="space-y-6"><Card><CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm uppercase tracking-[0.24em] text-slate-500">Activity</p><h2 className="text-3xl font-semibold text-white">Weekly leaderboard</h2></div><Button variant="outline" loading={resettingWeek} onClick={async () => { setResettingWeek(true); try { await api.post('/api/activity/reset'); showToast('Updated'); await loadDashboard(true); } catch (error) { handleError(error, 'Unable to reset this week.'); } finally { setResettingWeek(false); } }}><RefreshCcw className="h-4 w-4" />Reset Week</Button></CardContent></Card><Card><CardContent className="pt-6">{leaderboard.length ? <Table><TableHead><tr><TableHeaderCell>Rank</TableHeaderCell><TableHeaderCell>User</TableHeaderCell><TableHeaderCell>Voice Time</TableHeaderCell><TableHeaderCell>Messages</TableHeaderCell><TableHeaderCell>Score</TableHeaderCell></tr></TableHead><TableBody>{leaderboard.map((item, index) => <TableRow key={item.id}><TableCell className="font-semibold text-cyan-100">#{index + 1}</TableCell><TableCell><button onClick={() => setSelectedUser(item)} className="font-semibold text-white transition hover:text-cyan-100">{userLabel(item)}</button></TableCell><TableCell>{formatDuration(item.voice_time)}</TableCell><TableCell>{item.messages}</TableCell><TableCell>{score(item)}</TableCell></TableRow>)}</TableBody></Table> : <div className="rounded-[24px] border border-white/10 bg-white/4 p-8 text-center text-slate-400">No activity yet.</div>}</CardContent></Card></div> : null}
            {activeTab === 'logs' ? <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]"><Card><CardHeader><CardTitle>Server log settings</CardTitle><CardDescription>Choose where Discord log messages should go.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="surface-soft flex items-center justify-between gap-4 rounded-[26px] p-5"><div><p className="text-sm font-semibold text-white">Server logs</p><p className="mt-1 text-sm text-slate-400">Turn Discord log delivery on or off.</p></div><Button variant={logSettingsDraft.enabled ? 'secondary' : 'default'} onClick={() => setLogSettingsDraft((current) => ({ ...current, enabled: !current.enabled }))}>{logSettingsDraft.enabled ? 'Turn Off' : 'Turn On'}</Button></div><SelectField value={logSettingsDraft.moderation_channel_id || ''} onChange={(event) => setLogSettingsDraft((current) => ({ ...current, moderation_channel_id: event.target.value }))}><option value="">Moderation logs</option>{channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField><SelectField value={logSettingsDraft.event_channel_id || ''} onChange={(event) => setLogSettingsDraft((current) => ({ ...current, event_channel_id: event.target.value }))}><option value="">Event logs</option>{channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField><SelectField value={logSettingsDraft.system_channel_id || ''} onChange={(event) => setLogSettingsDraft((current) => ({ ...current, system_channel_id: event.target.value }))}><option value="">System logs</option>{channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField><Button variant="secondary" loading={savingLogs} onClick={async () => { setSavingLogs(true); try { await api.post('/api/log-settings', { enabled: logSettingsDraft.enabled, moderation_channel_id: String(logSettingsDraft.moderation_channel_id || '').trim() || null, event_channel_id: String(logSettingsDraft.event_channel_id || '').trim() || null, system_channel_id: String(logSettingsDraft.system_channel_id || '').trim() || null }); showToast('Saved'); await loadDashboard(true); } catch (error) { handleError(error, 'Unable to save log settings.'); } finally { setSavingLogs(false); } }}>Save</Button></CardContent></Card><Card><CardHeader><CardTitle>Dashboard logs</CardTitle><CardDescription>Filter recent dashboard activity.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 md:grid-cols-[1fr,0.4fr]"><div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><input value={logSearch} onChange={(event) => setLogSearch(event.target.value)} placeholder="Search logs" className="surface-soft h-11 w-full rounded-2xl pl-11 pr-4 text-sm text-slate-100 placeholder:text-slate-500" /></div><SelectField value={logSource} onChange={(event) => setLogSource(event.target.value)}><option value="all">All sources</option>{Array.from(new Set(logs.map((item) => String(item.source || 'system')))).map((item) => <option key={item} value={item}>{item}</option>)}</SelectField></div><div className="space-y-3">{filteredLogs.slice(0, 14).map((item) => <div key={item.id} className="surface-soft rounded-[24px] p-4"><div className="flex flex-wrap items-center gap-3"><Badge variant={item.level === 'warning' ? 'warning' : 'default'}>{item.level || 'info'}</Badge><span className="text-xs uppercase tracking-[0.22em] text-slate-500">{item.source || 'system'}</span><span className="ml-auto text-xs text-slate-500">{formatDate(item.timestamp)}</span></div><p className="mt-3 text-sm leading-7 text-slate-300">{item.message}</p></div>)}</div></CardContent></Card></div> : null}
          </main>
        </div>
      </div>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}><DialogContent className="w-[min(96vw,760px)]"><DialogHeader><DialogTitle>{eventForm.id ? 'Edit event' : 'Create event'}</DialogTitle><DialogDescription>Set the schedule and where the event should go.</DialogDescription></DialogHeader><DialogBody><div className="grid gap-4 md:grid-cols-2"><input value={eventForm.name} onChange={(event) => updateEventField('name', event.target.value)} placeholder="Event name" className="surface-soft h-11 rounded-2xl px-4 text-sm text-slate-100 placeholder:text-slate-500" /><TimeInput value={eventForm.time} onChange={(event) => updateEventField('time', event.target.value)} /><SelectField value={eventForm.mode} onChange={(event) => updateEventField('mode', event.target.value)}><option value="server">Server</option><option value="dm">DM</option></SelectField><SelectField value={eventForm.enabled ? 'on' : 'off'} onChange={(event) => updateEventField('enabled', event.target.value === 'on')}><option value="on">On</option><option value="off">Off</option></SelectField><SelectField value={eventForm.targetType} onChange={(event) => updateEventField('targetType', event.target.value)}>{eventForm.mode === 'server' ? <><option value="channel">Channel</option><option value="role">Role</option></> : <><option value="user">User</option><option value="role">Role</option></>}</SelectField><SelectField value={eventForm.daily ? 'daily' : 'once'} onChange={(event) => updateEventField('daily', event.target.value === 'daily')}><option value="once">One time</option><option value="daily">Daily</option></SelectField></div>{eventForm.targetType === 'channel' ? <SelectField className="mt-4" value={eventForm.targetId} onChange={(event) => updateEventField('targetId', event.target.value)}><option value="">Choose a channel</option>{channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField> : null}{eventForm.targetType === 'role' ? <SelectField className="mt-4" value={eventForm.targetId} onChange={(event) => updateEventField('targetId', event.target.value)}><option value="">Choose a role</option>{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField> : null}{eventForm.targetType === 'user' ? <div className="mt-4 space-y-3"><input value={eventSearchUsers} onChange={(event) => setEventSearchUsers(event.target.value)} placeholder="Search users" className="surface-soft h-11 w-full rounded-2xl px-4 text-sm text-slate-100 placeholder:text-slate-500" /><div className="surface-soft max-h-52 space-y-2 overflow-y-auto rounded-[24px] p-2">{roster.filter((item) => `${userLabel(item)} ${item.username || ''}`.toLowerCase().includes(eventSearchUsers.trim().toLowerCase())).slice(0, 8).map((item) => <button key={item.id} onClick={() => updateEventField('targetId', String(item.id))} className={cn('flex w-full items-center justify-between rounded-[18px] px-4 py-3 text-left text-sm transition', String(eventForm.targetId) === String(item.id) ? 'bg-cyan-300/12 text-white' : 'text-slate-300 hover:bg-white/6')}><span>{userLabel(item)}</span>{String(eventForm.targetId) === String(item.id) ? <CheckCircle2 className="h-4 w-4 text-cyan-100" /> : null}</button>)}</div></div> : null}{eventForm.mode === 'server' && eventForm.targetType === 'channel' ? <SelectField className="mt-4" value={eventForm.mentionRoleId || ''} onChange={(event) => updateEventField('mentionRoleId', event.target.value)}><option value="">Mention role</option>{roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</SelectField> : null}</DialogBody><DialogFooter><Button variant="ghost" onClick={() => setEventDialogOpen(false)}>Cancel</Button><Button loading={savingEvent} onClick={saveEvent}>Save</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}><DialogContent className="w-[min(96vw,640px)]"><DialogHeader><DialogTitle>{selectedEvent?.desc || 'Event details'}</DialogTitle><DialogDescription>Live event data from the current store.</DialogDescription></DialogHeader><DialogBody>{selectedEvent ? <div className="grid gap-4 md:grid-cols-2"><div className="surface-soft rounded-[24px] p-5"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Mode</p><p className="mt-2 text-xl font-semibold text-white">{selectedEvent.delivery_mode === 'dm' ? 'DM' : 'Server'}</p></div><div className="surface-soft rounded-[24px] p-5"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Status</p><p className="mt-2 text-xl font-semibold text-white">{selectedEvent.enabled ? 'On' : 'Off'}</p></div><div className="surface-soft rounded-[24px] p-5"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Target</p><p className="mt-2 text-xl font-semibold text-white">{targetLabel(selectedEvent)}</p></div><div className="surface-soft rounded-[24px] p-5"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Last triggered</p><p className="mt-2 text-xl font-semibold text-white">{formatDate(selectedEvent.last_reminded_date || selectedEvent.last_vote_date || selectedEvent.event_date)}</p></div></div> : null}</DialogBody><DialogFooter><Button variant="ghost" onClick={() => setSelectedEvent(null)}>Close</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}><DialogContent className="w-[min(96vw,640px)]"><DialogHeader><DialogTitle>{selectedUser ? userLabel(selectedUser) : 'User details'}</DialogTitle><DialogDescription>Roles, rank, voice time, and messages in one place.</DialogDescription></DialogHeader><DialogBody>{selectedUser ? <div className="space-y-4"><div className="grid gap-4 md:grid-cols-3"><div className="surface-soft rounded-[24px] p-5"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Voice Time</p><p className="mt-2 text-xl font-semibold text-white">{formatDuration(selectedUser.voice_time)}</p></div><div className="surface-soft rounded-[24px] p-5"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Messages</p><p className="mt-2 text-xl font-semibold text-white">{selectedUser.messages}</p></div><div className="surface-soft rounded-[24px] p-5"><p className="text-xs uppercase tracking-[0.22em] text-slate-500">Rank</p><p className="mt-2 text-xl font-semibold text-white">{Math.max(leaderboard.findIndex((item) => String(item.id) === String(selectedUser.id)) + 1, 1)}</p></div></div><div className="surface-soft rounded-[24px] p-5"><p className="text-sm font-semibold text-white">Roles</p><p className="mt-3 text-sm leading-7 text-slate-400">{selectedUser.roles?.length ? selectedUser.roles.map((roleId) => roleMap.get(String(roleId)) || 'Role').join(', ') : 'No roles'}</p></div></div> : null}</DialogBody><DialogFooter><Button variant="ghost" onClick={() => setSelectedUser(null)}>Close</Button></DialogFooter></DialogContent></Dialog>
      <Dialog open={Boolean(deleteEvent)} onOpenChange={(open) => !open && setDeleteEvent(null)}><DialogContent className="w-[min(96vw,520px)]"><DialogHeader><DialogTitle>Delete event</DialogTitle><DialogDescription>This removes the event from the live schedule.</DialogDescription></DialogHeader><DialogBody><div className="surface-soft rounded-[24px] p-5 text-sm text-slate-300">{deleteEvent?.desc || 'Selected event'}</div></DialogBody><DialogFooter><Button variant="ghost" onClick={() => setDeleteEvent(null)}>Cancel</Button><Button variant="danger" onClick={async () => { if (!deleteEvent) return; try { await api.post('/api/events/delete', { id: deleteEvent.id }); showToast('Deleted'); setDeleteEvent(null); await loadDashboard(true); } catch (error) { handleError(error, 'Unable to delete the event.'); } }}>Delete</Button></DialogFooter></DialogContent></Dialog>
      {toast ? <div className="fixed bottom-5 right-5 z-[80]"><div className={cn('surface-highlight flex items-center gap-3 rounded-[24px] px-5 py-4 text-sm font-medium text-white', toast.tone === 'error' ? 'border-rose-300/20 bg-rose-300/10' : 'border-cyan-300/18')}><AlertCircle className={cn('h-4 w-4', toast.tone === 'error' ? 'text-rose-200' : 'text-cyan-100')} />{toast.message}</div></div> : null}
    </>
  );
}
