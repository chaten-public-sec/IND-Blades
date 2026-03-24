import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, createRealtimeClient } from '../lib/api';

const EMPTY_BOOTSTRAP = {
  viewer: null,
  events: [],
  welcome: {},
  log_settings: {},
  discord_logs: {},
  activity: { users: {}, last_reset: 0 },
  activity_config: { afk_channel_id: null },
  autorole: { join_role_id: null, bindings: [], strike_mapping: {} },
  notification_settings: { enabled: false, user_ids: [] },
  strike_config: { expiry_days: 7, strike_mapping: {} },
  logs: [],
  users: [],
  channels: [],
  roles: [],
  notification_center: [],
  strike_requests: [],
  management: { settings: {}, assignments: [] },
  storage_mode: 'file',
  health: {},
  bot_status: 'disconnected',
};

export function useDashboard() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [events, setEvents] = useState([]);
  const [welcome, setWelcome] = useState({});
  const [logSettings, setLogSettings] = useState({});
  const [discordLogs, setDiscordLogs] = useState({});
  const [activity, setActivity] = useState({ users: {}, last_reset: 0 });
  const [activityConfig, setActivityConfig] = useState({ afk_channel_id: null });
  const [autorole, setAutorole] = useState({ join_role_id: null, bindings: [], strike_mapping: {} });
  const [notificationSettings, setNotificationSettings] = useState({ enabled: false, user_ids: [] });
  const [strikeConfig, setStrikeConfig] = useState({ expiry_days: 7, strike_mapping: {} });
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [notificationCenter, setNotificationCenter] = useState([]);
  const [strikeRequests, setStrikeRequests] = useState([]);
  const [management, setManagement] = useState({ settings: {}, assignments: [] });
  const [storageMode, setStorageMode] = useState('file');
  const [health, setHealth] = useState({});
  const [botStatus, setBotStatus] = useState('disconnected');
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [liveSync, setLiveSync] = useState(false);

  const showToast = async (type, message, id) => {
    const module = await import('../lib/toast');
    module.showToast(type, message, id || `${type}-${message}`);
  };

  const applyBootstrap = (payload) => {
    const data = { ...EMPTY_BOOTSTRAP, ...(payload || {}) };
    setViewer(data.viewer || null);
    setEvents(Array.isArray(data.events) ? data.events : []);
    setWelcome(data.welcome || {});
    setLogSettings(data.log_settings || {});
    setDiscordLogs(data.discord_logs || {});
    setActivity(data.activity || { users: {}, last_reset: 0 });
    setActivityConfig(data.activity_config || { afk_channel_id: null });
    setAutorole(data.autorole || { join_role_id: null, bindings: [], strike_mapping: {} });
    setNotificationSettings(data.notification_settings || { enabled: false, user_ids: [] });
    setStrikeConfig(data.strike_config || { expiry_days: 7, strike_mapping: {} });
    setLogs(Array.isArray(data.logs) ? data.logs : []);
    setUsers(Array.isArray(data.users) ? data.users : []);
    setChannels(Array.isArray(data.channels) ? data.channels : []);
    setRoles(Array.isArray(data.roles) ? data.roles : []);
    setNotificationCenter(Array.isArray(data.notification_center) ? data.notification_center : []);
    setStrikeRequests(Array.isArray(data.strike_requests) ? data.strike_requests : []);
    setManagement(data.management || { settings: {}, assignments: [] });
    setStorageMode(data.storage_mode || 'file');
    setHealth(data.health || {});
    setBotStatus(data.bot_status || 'disconnected');
  };

  const handleError = (error, fallback) => {
    if (error.response?.status === 401) {
      navigate('/', { replace: true });
      return;
    }
    setErrorMessage(error.response?.data?.error || fallback);
  };

  const loadDashboard = async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setErrorMessage('');

    try {
      const session = await api.get('/api/auth/session');
      if (!session.data?.authenticated || !session.data?.viewer) {
        navigate('/', { replace: true });
        return;
      }

      const response = await api.get('/api/dashboard/bootstrap');
      applyBootstrap(response.data || {});
    } catch (error) {
      handleError(error, 'Unable to load the dashboard right now.');
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      await loadDashboard(false);
      if (!mounted) return;

      const socket = createRealtimeClient();
      socketRef.current = socket;

      socket.on('connect', () => {
        if (!mounted) return;
        setLiveSync(true);
      });

      socket.on('disconnect', () => {
        if (!mounted) return;
        setLiveSync(false);
      });

      socket.on('connect_error', () => {
        if (!mounted) return;
        setLiveSync(false);
      });

      socket.on('systemUpdate', async (event) => {
        if (!mounted) return;
        if (event?.type === 'NOTIFICATION_CREATED') {
          setNotificationCenter((current) => [event.payload.notification, ...current].slice(0, 100));
          return;
        }
        if (event?.type === 'NOTIFICATIONS_UPDATED') {
          try {
            const response = await api.get('/api/notifications/center');
            if (mounted) {
              setNotificationCenter(Array.isArray(response.data) ? response.data : []);
            }
          } catch {}
          return;
        }
        await loadDashboard(true);
      });

      socket.connect();
    };

    connect();

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } finally {
      navigate('/', { replace: true });
    }
  };

  const roster = useMemo(() => {
    const rosterMap = new Map();

    users.forEach((user) => {
      rosterMap.set(String(user.id), {
        ...user,
        voice_time: Number(user.voice_time || 0),
        messages: Number(user.messages || 0),
      });
    });

    Object.entries(activity.users || {}).forEach(([id, stats]) => {
      const current = rosterMap.get(String(id)) || {
        id,
        name: `User ${String(id).slice(-4)}`,
        username: null,
        roles: [],
        strikes: [],
      };

      rosterMap.set(String(id), {
        ...current,
        voice_time: Number(stats.voice_time || current.voice_time || 0),
        messages: Number(stats.messages || current.messages || 0),
      });
    });

    return Array.from(rosterMap.values()).sort((left, right) => (left.name || '').localeCompare(right.name || ''));
  }, [activity.users, users]);

  const leaderboard = useMemo(() => (
    [...roster]
      .map((user) => ({
        ...user,
        score: Math.round((Number(user.voice_time || 0) / 60) * 2 + Number(user.messages || 0)),
      }))
      .sort((left, right) => right.score - left.score || right.messages - left.messages)
  ), [roster]);

  const myProfile = useMemo(
    () => roster.find((item) => String(item.id) === String(viewer?.id)) || null,
    [roster, viewer?.id]
  );

  const myStrikes = myProfile?.strikes || [];
  const unreadNotifications = notificationCenter.filter((item) => !item.read_at).length;

  const selfProfile = useMemo(() => {
    if (!viewer) {
      return null;
    }

    return {
      ...myProfile,
      ...viewer,
      name: myProfile?.name || viewer.display_name || viewer.username || 'IND Member',
      display_name: viewer.display_name || myProfile?.name || viewer.username || 'IND Member',
      username: viewer.username || myProfile?.username || null,
      avatar_url: myProfile?.avatar_url || viewer.avatar_url || null,
      roles: myProfile?.roles || viewer.discord_role_ids || [],
      joined_at: myProfile?.joined_at || viewer.guild_joined_at || null,
      guild_joined_at: viewer.guild_joined_at || myProfile?.joined_at || null,
      website_roles: myProfile?.website_roles || viewer.website_roles || [],
      primary_role: myProfile?.primary_role || viewer.primary_role || null,
      strikes: myProfile?.strikes || [],
      strike_count: myProfile?.strike_count || 0,
      voice_time: Number(myProfile?.voice_time || 0),
      messages: Number(myProfile?.messages || 0),
    };
  }, [myProfile, viewer]);

  return {
    viewer,
    events,
    welcome,
    logSettings,
    discordLogs,
    activity,
    activityConfig,
    autorole,
    notificationSettings,
    strikeConfig,
    logs,
    users,
    channels,
    roles,
    notificationCenter,
    strikeRequests,
    management,
    storageMode,
    health,
    botStatus,
    loading,
    errorMessage,
    liveSync,
    roster,
    leaderboard,
    myProfile,
    selfProfile,
    myStrikes,
    unreadNotifications,
    setWelcome,
    setLogSettings,
    setDiscordLogs,
    setActivityConfig,
    setAutorole,
    setNotificationSettings,
    setStrikeConfig,
    setManagement,
    showToast,
    handleError,
    loadDashboard,
    logout,
  };
}
