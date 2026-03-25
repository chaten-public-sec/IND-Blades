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
      <div className="min-h-screen bg-gray-50 px-4 py-8 font-sans dark:bg-gray-950 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
          <Card className="h-fit min-h-[600px] w-full rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:w-64">
            <Skeleton className="h-full w-full rounded" />
          </Card>
          <div className="flex-1 space-y-6">
            <Card className="rounded-md border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <Skeleton className="h-24 rounded" />
            </Card>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Card key={index} className="rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <Skeleton className="h-20 rounded" />
                </Card>
              ))}
            </div>
            <Card className="rounded-md border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <Skeleton className="h-[400px] rounded" />
            </Card>
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
    { label: 'Total Users', value: roster.length, meta: 'Visible records', icon: Users },
    { label: 'Active Users', value: roster.filter((item) => item.messages || item.voice_time).length, meta: 'Messages or voice this week', icon: Activity },
    { label: 'Scheduled Events', value: events.filter((item) => item.enabled).length, meta: `${events.length} total defined`, icon: CalendarDays },
    { label: 'System Status', value: ping >= 0 ? 'Online' : 'Offline', meta: ping >= 0 ? `${ping}ms response` : 'Check connection', icon: Gauge }
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-50 px-4 py-8 font-sans dark:bg-gray-950 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 lg:flex-row">
          <aside className="sticky top-8 flex h-fit max-h-[calc(100vh-4rem)] w-full flex-col rounded-md border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:w-64">
            <div className="mb-6 border-b border-gray-200 pb-4 dark:border-gray-800">
              <h2 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">IND Blades</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Administration</p>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200'
                        : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
            <div className="mt-6 border-t border-gray-200 pt-4 dark:border-gray-800">
              <Button
                variant="outline"
                className="w-full justify-start text-gray-700 dark:text-gray-300"
                onClick={async () => {
                  try {
                    await api.post('/api/logout');
                  } finally {
                    navigate('/login', { replace: true });
                  }
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </aside>

          <main className="flex-1 space-y-6">
            <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <CardContent className="flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {navItems.find(i => i.id === activeTab)?.label || 'Dashboard'}
                  </h1>
                  <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <div className={cn("h-2 w-2 rounded-full", ping >= 0 ? "bg-green-500" : "bg-red-500")} />
                      API {ping >= 0 ? 'Online' : 'Offline'}
                    </span>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <div className={cn("h-2 w-2 rounded-full", liveSync ? "bg-blue-500" : "bg-yellow-500")} />
                      {liveSync ? 'Sync Active' : 'Connecting'}
                    </span>
                    {refreshing && (
                      <>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <LoaderCircle className="h-3 w-3 animate-spin" /> Fetching
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => loadDashboard(true)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </CardContent>
            </Card>

            {errorMessage && (
              <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">Error:</span> {errorMessage}
                </div>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {stats.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Card key={item.label} className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.label}</p>
                            <Icon className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                          </div>
                          <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{item.value}</p>
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{item.meta}</p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-col lg:flex-row">
                    <div className="flex-1 p-6 sm:p-8">
                      <h2 className="text-xl font-semibold text-gray-900 dark:text-white">System Overview</h2>
                      <p className="mt-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                        Welcome to the IND Blades administrative interface. This unified panel provides direct control over server events, user analytics, automated welcome procedures, and detailed activity logs.
                      </p>
                      <p className="mt-2 text-gray-600 dark:text-gray-300 leading-relaxed">
                        All changes made here are synchronized in real-time with your active bot instances and Discord servers.
                      </p>
                    </div>
                    <div className="relative hidden w-1/3 min-w-[300px] border-l border-gray-200 dark:border-gray-800 lg:block">
                      <img src={heroImage} alt="Dashboard Illustration" className="h-full w-full object-cover opacity-80 dark:opacity-50 grayscale" />
                      <div className="absolute inset-0 bg-gray-900/10 dark:bg-gray-900/60" />
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'events' && (
              <div className="space-y-6">
                <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={eventSearch}
                        onChange={(e) => setEventSearch(e.target.value)}
                        placeholder="Search events..."
                        className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        setEventForm({ ...emptyEventForm, targetId: firstChannelId || firstRoleId || firstUserId, mentionRoleId: firstRoleId || '' });
                        setEventDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      New Event
                    </Button>
                  </CardContent>
                </Card>
                <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="overflow-x-auto">
                    {filteredEvents.length ? (
                      <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                          <tr>
                            <th className="px-4 py-3 font-medium text-gray-900 dark:text-white">Event Name</th>
                            <th className="px-4 py-3 font-medium text-gray-900 dark:text-white">Schedule</th>
                            <th className="px-4 py-3 font-medium text-gray-900 dark:text-white">Target</th>
                            <th className="px-4 py-3 font-medium text-gray-900 dark:text-white">Status</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {filteredEvents.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              <td className="px-4 py-3">
                                <button onClick={() => setSelectedEvent(item)} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                                  {item.desc}
                                </button>
                                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {item.delivery_mode === 'dm' ? 'Direct Message' : 'Server Channel'} &bull; {item.daily ? 'Daily' : 'One-time'}
                                </div>
                              </td>
                              <td className="px-4 py-3">{item.time}</td>
                              <td className="px-4 py-3">{targetLabel(item)}</td>
                              <td className="px-4 py-3">
                                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", item.enabled ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300")}>
                                  {item.enabled ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => { setEventForm(buildEventForm(item)); setEventDialogOpen(true); }}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => quickAction(() => api.post('/api/events/toggle', { id: item.id, enabled: !item.enabled }))}>
                                    {item.enabled ? <Pause className="h-4 w-4 text-gray-500" /> : <Play className="h-4 w-4 text-gray-500" />}
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 dark:text-red-400" onClick={() => setDeleteEvent(item)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No events found matching your criteria.</div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'welcome' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <CardHeader className="border-b border-gray-200 pb-4 dark:border-gray-800">
                    <CardTitle className="text-lg">Configuration</CardTitle>
                    <CardDescription>Manage automated server greetings.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Welcome Module</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Currently {welcome.enabled ? 'active' : 'disabled'}.</p>
                      </div>
                      <Button
                        variant={welcome.enabled ? 'outline' : 'default'}
                        loading={welcomeSaving}
                        onClick={async () => {
                          setWelcomeSaving(true);
                          try {
                            const response = await api.post('/api/welcome/toggle', { enabled: !welcome.enabled });
                            setWelcome(response.data?.config || welcome);
                            setWelcomeChannelDraft(response.data?.config?.channel_id || welcomeChannelDraft);
                            showToast(response.data?.config?.enabled ? 'Module Enabled' : 'Module Disabled');
                          } catch (error) {
                            handleError(error, 'Failed to toggle welcome module.');
                          } finally {
                            setWelcomeSaving(false);
                          }
                        }}
                      >
                        {welcome.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Target Channel</label>
                      <select
                        value={welcomeChannelDraft}
                        onChange={(e) => setWelcomeChannelDraft(e.target.value)}
                        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="">Select a channel...</option>
                        {channels.map((item) => (
                          <option key={item.id} value={item.id}>{item.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <Button
                        loading={welcomeSaving}
                        onClick={async () => {
                          setWelcomeSaving(true);
                          try {
                            const response = await api.post('/api/welcome/channel', { channel_id: String(welcomeChannelDraft || '').trim() || null });
                            setWelcome(response.data?.config || welcome);
                            setWelcomeChannelDraft(response.data?.config?.channel_id || welcomeChannelDraft);
                            showToast('Configuration Saved');
                          } catch (error) {
                            handleError(error, 'Failed to save channel configuration.');
                          } finally {
                            setWelcomeSaving(false);
                          }
                        }}
                      >
                        Save Changes
                      </Button>
                      <Button
                        variant="outline"
                        loading={previewingWelcome}
                        onClick={async () => {
                          setPreviewingWelcome(true);
                          try {
                            if (welcomeChannelDraft !== (welcome.channel_id || '')) {
                              await api.post('/api/welcome/channel', { channel_id: String(welcomeChannelDraft || '').trim() || null });
                            }
                            await api.post('/api/welcome/preview');
                            showToast('Preview dispatched to channel.');
                          } catch (error) {
                            handleError(error, 'Failed to dispatch preview.');
                          } finally {
                            setPreviewingWelcome(false);
                          }
                        }}
                      >
                        <Send className="mr-2 h-4 w-4" />
                        Send Test Message
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <CardHeader className="border-b border-gray-200 pb-4 dark:border-gray-800">
                    <CardTitle className="text-lg">Message Preview</CardTitle>
                    <CardDescription>Example of the automated greeting.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="border-b border-gray-200 bg-gray-100 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                      <div className="rounded border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                        <p className="mb-2 text-sm font-bold text-blue-600 dark:text-blue-400">Welcome to IND Blades</p>
                        <div className="space-y-2 text-sm text-gray-800 dark:text-gray-200">
                          <p>Hello New Member,</p>
                          <p>Welcome to <strong>IND Blades Family</strong> ⚔️</p>
                          <p>⚡ Check out the channels and introduce yourself.</p>
                          <p>📌 Make sure to read the rules and have fun.</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 text-xs text-gray-500 dark:text-gray-400">
                      Currently mapped to: {channelMap.get(String(welcomeChannelDraft || welcome.channel_id || '')) || 'None selected'}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'users' && (
              <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                <CardHeader className="border-b border-gray-200 pb-4 dark:border-gray-800">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-lg">User Directory</CardTitle>
                      <CardDescription>Manage and view server members.</CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search users..."
                        className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                      />
                    </div>
                  </div>
                </CardHeader>
                <div className="overflow-x-auto">
                  {filteredUsers.length ? (
                    <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                      <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                        <tr>
                          <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Member</th>
                          <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Primary Roles</th>
                          <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Voice Activity</th>
                          <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Messages</th>
                          <th className="px-6 py-3 text-right font-medium text-gray-900 dark:text-white">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {filteredUsers.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                            <td className="px-6 py-3">
                              <div className="font-medium text-gray-900 dark:text-white">{userLabel(item)}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{item.username ? `@${item.username}` : 'ID: ' + item.id}</div>
                            </td>
                            <td className="px-6 py-3">
                              {item.roles?.length ? item.roles.slice(0, 2).map((roleId) => roleMap.get(String(roleId)) || 'Role').join(', ') + (item.roles.length > 2 ? '...' : '') : <span className="text-gray-400">None</span>}
                            </td>
                            <td className="px-6 py-3">{formatDuration(item.voice_time)}</td>
                            <td className="px-6 py-3">{item.messages}</td>
                            <td className="px-6 py-3 text-right">
                              <Button variant="outline" size="sm" onClick={() => setSelectedUser(item)}>
                                View
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No members found.</div>
                  )}
                </div>
              </Card>
            )}

            {activeTab === 'activity' && (
              <div className="space-y-6">
                <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <CardContent className="flex items-center justify-between p-5">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Leaderboard</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Top contributors based on calculated activity score.</p>
                    </div>
                    <Button
                      variant="outline"
                      loading={resettingWeek}
                      onClick={async () => {
                        if (!window.confirm("Are you sure you want to reset all activity metrics?")) return;
                        setResettingWeek(true);
                        try {
                          await api.post('/api/activity/reset');
                          showToast('Metrics reset successfully.');
                          await loadDashboard(true);
                        } catch (error) {
                          handleError(error, 'Failed to reset metrics.');
                        } finally {
                          setResettingWeek(false);
                        }
                      }}
                    >
                      Reset Metrics
                    </Button>
                  </CardContent>
                </Card>
                <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <div className="overflow-x-auto">
                    {leaderboard.length ? (
                      <table className="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/50">
                          <tr>
                            <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Rank</th>
                            <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Member</th>
                            <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Voice Duration</th>
                            <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Message Count</th>
                            <th className="px-6 py-3 font-medium text-gray-900 dark:text-white">Total Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                          {leaderboard.map((item, index) => (
                            <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                              <td className="px-6 py-3 font-medium text-gray-900 dark:text-white">{index + 1}</td>
                              <td className="px-6 py-3">
                                <button onClick={() => setSelectedUser(item)} className="font-medium text-blue-600 hover:underline dark:text-blue-400">
                                  {userLabel(item)}
                                </button>
                              </td>
                              <td className="px-6 py-3">{formatDuration(item.voice_time)}</td>
                              <td className="px-6 py-3">{item.messages}</td>
                              <td className="px-6 py-3 font-semibold text-gray-900 dark:text-white">{score(item)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">No recorded activity.</div>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <CardHeader className="border-b border-gray-200 pb-4 dark:border-gray-800">
                    <CardTitle className="text-lg">Logging Configuration</CardTitle>
                    <CardDescription>Route system events to Discord channels.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Global Logging</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Master switch for all log outputs.</p>
                      </div>
                      <Button
                        variant={logSettingsDraft.enabled ? 'outline' : 'default'}
                        onClick={() => setLogSettingsDraft((curr) => ({ ...curr, enabled: !curr.enabled }))}
                      >
                        {logSettingsDraft.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                    <div className="space-y-3 pt-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Moderation Logs</label>
                      <select
                        value={logSettingsDraft.moderation_channel_id || ''}
                        onChange={(e) => setLogSettingsDraft((curr) => ({ ...curr, moderation_channel_id: e.target.value }))}
                        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="">None</option>
                        {channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Event Logs</label>
                      <select
                        value={logSettingsDraft.event_channel_id || ''}
                        onChange={(e) => setLogSettingsDraft((curr) => ({ ...curr, event_channel_id: e.target.value }))}
                        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="">None</option>
                        {channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">System Logs</label>
                      <select
                        value={logSettingsDraft.system_channel_id || ''}
                        onChange={(e) => setLogSettingsDraft((curr) => ({ ...curr, system_channel_id: e.target.value }))}
                        className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                      >
                        <option value="">None</option>
                        {channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                      </select>
                    </div>
                    <div className="pt-2">
                      <Button
                        loading={savingLogs}
                        onClick={async () => {
                          setSavingLogs(true);
                          try {
                            await api.post('/api/log-settings', {
                              enabled: logSettingsDraft.enabled,
                              moderation_channel_id: String(logSettingsDraft.moderation_channel_id || '').trim() || null,
                              event_channel_id: String(logSettingsDraft.event_channel_id || '').trim() || null,
                              system_channel_id: String(logSettingsDraft.system_channel_id || '').trim() || null
                            });
                            showToast('Log routing updated.');
                            await loadDashboard(true);
                          } catch (error) {
                            handleError(error, 'Failed to save log configuration.');
                          } finally {
                            setSavingLogs(false);
                          }
                        }}
                      >
                        Save Configuration
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="rounded-md border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <CardHeader className="border-b border-gray-200 pb-4 dark:border-gray-800">
                    <CardTitle className="text-lg">System Output</CardTitle>
                    <CardDescription>Recent dashboard and internal events.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                        <input
                          value={logSearch}
                          onChange={(e) => setLogSearch(e.target.value)}
                          placeholder="Search entries..."
                          className="h-9 w-full rounded-md border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
                        />
                      </div>
                      <select
                        value={logSource}
                        onChange={(e) => setLogSource(e.target.value)}
                        className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 sm:w-40"
                      >
                        <option value="all">All Sources</option>
                        {Array.from(new Set(logs.map((item) => String(item.source || 'system')))).map((item) => (
                          <option key={item} value={item}>{item.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      {filteredLogs.length ? filteredLogs.slice(0, 14).map((item) => (
                        <div key={item.id} className="rounded border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-gray-800/50">
                          <div className="mb-1 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "rounded px-1.5 py-0.5 text-xs font-medium uppercase",
                                item.level === 'warning' ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500" :
                                  item.level === 'error' ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-500" :
                                    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                              )}>
                                {item.level || 'info'}
                              </span>
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{item.source || 'system'}</span>
                            </div>
                            <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(item.timestamp)}</span>
                          </div>
                          <p className="text-gray-700 dark:text-gray-300">{item.message}</p>
                        </div>
                      )) : (
                        <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">No logs match criteria.</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>

      <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
        <DialogContent className="w-[min(96vw,600px)] rounded-md border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">
              {eventForm.id ? 'Edit Event Schedule' : 'Create New Event'}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              Configure timing and routing for this event instance.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Identifier / Message</label>
                <input
                  value={eventForm.name}
                  onChange={(e) => updateEventField('name', e.target.value)}
                  placeholder="e.g. Daily Standup"
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Time (HH:MM)</label>
                <TimeInput
                  value={eventForm.time}
                  onChange={(e) => updateEventField('time', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Delivery Method</label>
                <select
                  value={eventForm.mode}
                  onChange={(e) => updateEventField('mode', e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="server">Server Broadcast</option>
                  <option value="dm">Direct Message</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Recurrence</label>
                <select
                  value={eventForm.daily ? 'daily' : 'once'}
                  onChange={(e) => updateEventField('daily', e.target.value === 'daily')}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="once">Execute Once</option>
                  <option value="daily">Execute Daily</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Target Type</label>
                <select
                  value={eventForm.targetType}
                  onChange={(e) => updateEventField('targetType', e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  {eventForm.mode === 'server' ? (
                    <>
                      <option value="channel">Specific Channel</option>
                      <option value="role">Role Members</option>
                    </>
                  ) : (
                    <>
                      <option value="user">Specific User</option>
                      <option value="role">Role Members (DM All)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {eventForm.targetType === 'channel' && (
              <div className="space-y-1 pt-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Destination Channel</label>
                <select
                  value={eventForm.targetId}
                  onChange={(e) => updateEventField('targetId', e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Select channel...</option>
                  {channels.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            )}

            {eventForm.targetType === 'role' && (
              <div className="space-y-1 pt-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Target Role</label>
                <select
                  value={eventForm.targetId}
                  onChange={(e) => updateEventField('targetId', e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">Select role...</option>
                  {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            )}

            {eventForm.targetType === 'user' && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Search & Select User</label>
                <input
                  value={eventSearchUsers}
                  onChange={(e) => setEventSearchUsers(e.target.value)}
                  placeholder="Type to filter..."
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                <div className="max-h-40 overflow-y-auto rounded-md border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900">
                  {roster.filter((item) => `${userLabel(item)} ${item.username || ''}`.toLowerCase().includes(eventSearchUsers.trim().toLowerCase())).slice(0, 8).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => updateEventField('targetId', String(item.id))}
                      className={cn(
                        'flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm font-medium transition-colors',
                        String(eventForm.targetId) === String(item.id)
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100'
                          : 'text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800'
                      )}
                    >
                      <span>{userLabel(item)}</span>
                      {String(eventForm.targetId) === String(item.id) && <CheckCircle2 className="h-4 w-4" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {eventForm.mode === 'server' && eventForm.targetType === 'channel' && (
              <div className="space-y-1 pt-2">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Optional: Role to Mention</label>
                <select
                  value={eventForm.mentionRoleId || ''}
                  onChange={(e) => updateEventField('mentionRoleId', e.target.value)}
                  className="h-9 w-full rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                >
                  <option value="">None</option>
                  {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 pt-2">
              <input
                id="event-enabled"
                type="checkbox"
                checked={eventForm.enabled}
                onChange={(e) => updateEventField('enabled', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
              />
              <label htmlFor="event-enabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enable immediately upon saving
              </label>
            </div>
          </DialogBody>
          <DialogFooter className="mt-6 flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
            <Button variant="outline" onClick={() => setEventDialogOpen(false)}>Cancel</Button>
            <Button loading={savingEvent} onClick={saveEvent}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedEvent)} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent className="w-[min(96vw,500px)] rounded-md border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader className="mb-4 border-b border-gray-200 pb-4 dark:border-gray-800">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">Event Properties</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">Current record for: {selectedEvent?.desc}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {selectedEvent && (
              <div className="grid grid-cols-2 gap-y-6">
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Method</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedEvent.delivery_mode === 'dm' ? 'Direct Message' : 'Server Broadcast'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Status</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{selectedEvent.enabled ? 'Active' : 'Disabled'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Target Assignment</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{targetLabel(selectedEvent)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Last Execution / Baseline</p>
                  <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatDate(selectedEvent.last_reminded_date || selectedEvent.last_vote_date || selectedEvent.event_date)}</p>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="mt-6">
            <Button variant="outline" className="w-full" onClick={() => setSelectedEvent(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)}>
        <DialogContent className="w-[min(96vw,500px)] rounded-md border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader className="mb-4 border-b border-gray-200 pb-4 dark:border-gray-800">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">Member Record</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">{selectedUser ? userLabel(selectedUser) : ''}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            {selectedUser && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 divide-x divide-gray-200 rounded border border-gray-200 bg-gray-50 text-center dark:divide-gray-700 dark:border-gray-800 dark:bg-gray-800/50">
                  <div className="p-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Rank</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                      #{Math.max(leaderboard.findIndex((item) => String(item.id) === String(selectedUser.id)) + 1, 1)}
                    </p>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Voice</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{formatDuration(selectedUser.voice_time)}</p>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Msgs</p>
                    <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{selectedUser.messages}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">Assigned Roles</p>
                  <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">
                    {selectedUser.roles?.length ? selectedUser.roles.map((roleId) => roleMap.get(String(roleId)) || 'Unknown Role').join(', ') : 'No roles assigned'}
                  </p>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="mt-6">
            <Button variant="outline" className="w-full" onClick={() => setSelectedUser(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteEvent)} onOpenChange={(open) => !open && setDeleteEvent(null)}>
        <DialogContent className="w-[min(96vw,400px)] rounded-md border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-800 dark:bg-gray-900">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-white">Confirm Deletion</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to remove <span className="font-semibold text-gray-900 dark:text-white">"{deleteEvent?.desc}"</span>? This action cannot be reversed.
            </p>
          </DialogBody>
          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteEvent(null)}>Cancel</Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
              onClick={async () => {
                if (!deleteEvent) return;
                try {
                  await api.post('/api/events/delete', { id: deleteEvent.id });
                  showToast('Event permanently deleted.');
                  setDeleteEvent(null);
                  await loadDashboard(true);
                } catch (error) {
                  handleError(error, 'Failed to process deletion.');
                }
              }}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-5">
          <div className={cn(
            'flex items-center gap-3 rounded-md border bg-white px-4 py-3 shadow-lg dark:bg-gray-800',
            toast.tone === 'error' ? 'border-red-200 dark:border-red-900/50' : 'border-gray-200 dark:border-gray-700'
          )}>
            <AlertCircle className={cn('h-5 w-5', toast.tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400')} />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{toast.message}</span>
          </div>
        </div>
      )}
    </>
  );
}