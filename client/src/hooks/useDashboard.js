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

  const showToast = useCallback((type, message, id) => {
    import('../lib/toast').then(m => m.showToast(type, message, id));
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
            case 'EVENT_UPDATED':
            case 'EVENT_DELETED':
            case 'EVENT_PAUSED':
            case 'EVENT_RESUMED':
            case 'EVENT_ATTENDANCE_UPDATED':
              refreshEvents();
              break;
            case 'WELCOME_UPDATED':
              refreshWelcome();
              break;
            case 'USER_UPDATED':
            case 'STRIKE_ADDED':
            case 'STRIKE_REMOVED':
            case 'ROLE_UPDATED':
              refreshUsers();
              break;
            case 'LOG_UPDATED':
              refreshLogs();
              break;
            case 'AUTOROLE_UPDATED':
              setAutorole(data.payload.config || { join_role_id: null, bindings: [], strike_mapping: {} });
              break;
            case 'NOTIFICATIONS_UPDATED':
              setNotifications(data.payload.config || { enabled: false, user_ids: [] });
              break;
            case 'STRIKE_CONFIG_UPDATED':
              setStrikeConfig(data.payload || { expiry_days: 7 });
              break;
            case 'BOT_STATUS_UPDATED':
            case 'BOT_STATUS':
              const isConnected = data.payload?.connected;
              setBotStatus(isConnected ? 'connected' : 'disconnected');
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
