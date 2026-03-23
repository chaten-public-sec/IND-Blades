import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, createRealtimeClient } from '../lib/api';
import { toast as sonnerToast } from 'sonner';

export function useDashboard() {
  const [events, setEvents] = useState([]);
  const [config, setConfig] = useState({});
  const [activity, setActivity] = useState({ users: {}, last_reset: 0 });
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [channels, setChannels] = useState([]);
  const [roles, setRoles] = useState([]);
  const [health, setHealth] = useState({});
  const [autorole, setAutorole] = useState({ join_role_id: null, bindings: [], strike_mapping: {} });
  const [notifications, setNotifications] = useState({ enabled: false, user_ids: [] });
  const [strikeConfig, setStrikeConfig] = useState({ expiry_days: 7 });
  const [activityConfig, setActivityConfig] = useState({ afk_channel_id: null });
  const [ping, setPing] = useState(-1);
  const [botStatus, setBotStatus] = useState('disconnected');
  const [liveSync, setLiveSync] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (type === 'error') sonnerToast.error(message);
    else if (type === 'info') sonnerToast.info(message);
    else sonnerToast.success(message);
  }, []);

  const handleError = useCallback((error, fallback) => {
    if (error.response?.status === 401) {
      navigate('/login', { replace: true });
      return;
    }
    setErrorMessage(error.response?.data?.error || fallback);
  }, [navigate]);

  const refreshPing = useCallback(async () => {
    try {
      const s = Date.now();
      const r = await api.get('/api/test');
      setPing(Date.now() - s);
      setHealth(r.data || {});
    } catch {
      setPing(-1);
    }
  }, []);

  const refreshEvents = useCallback(async () => {
    try {
      const r = await api.get('/api/events');
      setEvents(Array.isArray(r.data) ? r.data : []);
    } catch {}
  }, []);

  const refreshWelcome = useCallback(async () => {
    try {
      const r = await api.get('/api/welcome');
      setConfig(r.data || {});
    } catch {}
  }, []);

  const refreshActivity = useCallback(async () => {
    try {
      const r = await api.get('/api/activity/stats');
      setActivity(r.data || { users: {}, last_reset: 0 });
    } catch {}
  }, []);

  const refreshLogs = useCallback(async () => {
    try {
      const r = await api.get('/api/logs');
      setLogs(Array.isArray(r.data) ? r.data : []);
    } catch {}
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const r = await api.get('/api/users');
      setUsers(Array.isArray(r.data) ? r.data : []);
    } catch {}
  }, []);

  const refreshStrikeConfig = useCallback(async () => {
    try {
      const r = await api.get('/api/strikes/config');
      setStrikeConfig(r.data || { expiry_days: 7 });
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;
    let interval = null;

    const load = async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const auth = await api.get('/api/check-session');
        if (!active) return;
        if (!auth.data?.authenticated) {
          navigate('/login', { replace: true });
          return;
        }

        await refreshPing();

        const [bootstrap, channelsRes, rolesRes] = await Promise.all([
          api.get('/api/dashboard/bootstrap'),
          api.get('/api/channels').catch(() => ({ data: [] })),
          api.get('/api/roles').catch(() => ({ data: [] })),
        ]);

        if (!active) return;

        const d = bootstrap.data || {};
        setHealth(d.health || {});
        setEvents(Array.isArray(d.events) ? d.events : []);
        setConfig(d.welcome || {});
        setActivity(d.activity || { users: {}, last_reset: 0 });
        setLogs(Array.isArray(d.logs) ? d.logs : []);
        setUsers(Array.isArray(d.users) ? d.users : []);
        setAutorole(d.autorole || { join_role_id: null, bindings: [], strike_mapping: {} });
        setNotifications(d.notifications || { enabled: false, user_ids: [] });
        setStrikeConfig(d.strike_config || { expiry_days: 7 });
        setActivityConfig(d.activity_config || { afk_channel_id: null });
        setBotStatus(d.bot_status || 'disconnected');
        setChannels(Array.isArray(channelsRes.data) ? channelsRes.data : []);
        setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : []);

        const socket = createRealtimeClient();
        socketRef.current = socket;
        socket.on('connect', () => {
          if (!active) return;
          setLiveSync(true);
          // Re-fetch all data on reconnect
          if (socketRef.current?._reconnecting) {
            refreshEvents();
            refreshWelcome();
            refreshActivity();
            refreshUsers();
            refreshLogs();
            refreshStrikeConfig();
            showToast('Reconnected. Data synced.');
          }
          socketRef.current._reconnecting = true;
        });
        socket.on('disconnect', () => active && setLiveSync(false));
        socket.on('connect_error', () => active && setLiveSync(false));

        socket.on('systemUpdate', (data) => {
          if (!active) return;
          console.log('[Socket] System Update:', data.type, data.payload);

          switch (data.type) {
            case 'EVENT_CREATED':
              showToast(`Event "${data.payload?.event?.desc || ''}" created.`);
              refreshEvents();
              break;
            case 'EVENT_UPDATED':
              showToast(`Event "${data.payload?.event?.desc || ''}" updated.`);
              refreshEvents();
              break;
            case 'EVENT_DELETED':
              showToast(`Event "${data.payload?.name || ''}" deleted.`);
              refreshEvents();
              break;
            case 'EVENT_PAUSED':
              showToast(`Event "${data.payload?.event?.desc || ''}" paused.`);
              refreshEvents();
              break;
            case 'EVENT_RESUMED':
              showToast(`Event "${data.payload?.event?.desc || ''}" resumed.`);
              refreshEvents();
              break;
            case 'EVENT_ATTENDANCE_UPDATED':
              showToast('Attendance updated.');
              refreshEvents();
              break;
            case 'WELCOME_UPDATED':
              showToast('Welcome settings updated.');
              refreshWelcome();
              break;
            case 'USER_UPDATED':
            case 'STRIKE_ADDED':
              showToast('Strike added.');
              refreshUsers();
              break;
            case 'STRIKE_REMOVED':
              showToast('Strike removed.');
              refreshUsers();
              break;
            case 'ROLE_UPDATED':
              showToast('User roles updated.');
              refreshUsers();
              break;
            case 'LOG_UPDATED':
              refreshLogs();
              break;
            case 'AUTOROLE_UPDATED':
              showToast('Auto role settings updated.');
              setAutorole(data.payload.config || { join_role_id: null, bindings: [], strike_mapping: {} });
              break;
            case 'NOTIFICATIONS_UPDATED':
              showToast('Notification settings updated.');
              setNotifications(data.payload.config || { enabled: false, user_ids: [] });
              break;
            case 'STRIKE_CONFIG_UPDATED':
              showToast('Strike configuration updated.');
              setStrikeConfig(data.payload || { expiry_days: 7 });
              break;
            case 'LOG_SETTINGS_UPDATED':
              showToast('Log settings updated.');
              break;
            case 'DISCORD_LOGS_UPDATED':
              showToast('Discord log settings updated.');
              break;
            case 'ACTIVITY_CONFIG_UPDATED':
              setActivityConfig(data.payload?.config || { afk_channel_id: null });
              showToast('Activity config updated.');
              break;
            case 'BOT_STATUS_UPDATED':
              const isConnected = data.payload?.connected;
              setBotStatus(isConnected ? 'connected' : 'disconnected');
              if (isConnected) showToast('Discord bot is back online.', 'info');
              else showToast('Discord bot went offline.', 'error');
              break;
            case 'SYSTEM_REFRESH':
              refreshEvents();
              refreshWelcome();
              refreshActivity();
              refreshUsers();
              break;
            default:
              console.warn('[Socket] Unknown update type:', data.type);
          }
        });

        socket.connect();

        interval = setInterval(refreshPing, 30000);
      } catch (error) {
        if (!active) return;
        if (error.response?.status === 401) {
          navigate('/login', { replace: true });
          return;
        }
        setErrorMessage(error.response?.data?.error || 'Failed to load dashboard.');
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
      if (interval) clearInterval(interval);
      if (socketRef.current) socketRef.current.disconnect();
    };
  }, [navigate, refreshPing, refreshEvents, refreshWelcome, refreshActivity, refreshLogs, refreshUsers, refreshStrikeConfig, showToast]);

  const logout = useCallback(async () => {
    try { await api.post('/api/logout'); } finally { navigate('/login', { replace: true }); }
  }, [navigate]);

  // Merge users + activity for roster
  const roster = (() => {
    const map = new Map();
    users.forEach((u) => map.set(u.id, { ...u, voice_time: Number(u.voice_time || 0), messages: Number(u.messages || 0) }));
    Object.entries(activity.users || {}).forEach(([id, s]) => {
      const c = map.get(id) || { id, name: `User ${id.slice(-4)}`, username: null, joined_at: null, roles: [] };
      map.set(id, { ...c, voice_time: Number(s.voice_time || c.voice_time || 0), messages: Number(s.messages || c.messages || 0) });
    });
    return Array.from(map.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  })();

  return {
    events, config, activity, logs, users, channels, roles, health, autorole, notifications, strikeConfig, activityConfig,
    ping, botStatus, liveSync, errorMessage, loading, roster,
    setConfig, setEvents, setAutorole, setNotifications, setStrikeConfig, setActivityConfig,
    showToast, handleError, logout, refreshEvents, refreshWelcome, refreshActivity, refreshLogs, refreshUsers, refreshStrikeConfig,
  };
}
