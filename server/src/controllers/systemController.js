const BOT_HEARTBEAT_TIMEOUT_MS = 90 * 1000;

function getConnectedState(botState) {
  const lastHeartbeatAt = Number(botState.lastHeartbeatAt || 0);
  if (!botState.connected || !lastHeartbeatAt) {
    return false;
  }
  return Date.now() - lastHeartbeatAt <= BOT_HEARTBEAT_TIMEOUT_MS;
}

function normalizeRuntime(runtime = {}) {
  return {
    presence_mode: String(runtime.presence_mode || 'idle'),
    reply_tone: String(runtime.reply_tone || 'friendly'),
    silent_mode: Boolean(runtime.silent_mode),
    identity_line: String(runtime.identity_line || 'IND Blades Control System'),
    tagline: String(runtime.tagline || "I don't speak much. I act."),
    profile_line: String(runtime.profile_line || ''),
    current_presence_text: String(runtime.current_presence_text || ''),
    current_presence_type: String(runtime.current_presence_type || 'watching'),
    last_presence_at: runtime.last_presence_at || null,
    member_count: Number(runtime.member_count || 0),
    active_events: Number(runtime.active_events || 0),
    active_strikes: Number(runtime.active_strikes || 0),
    message_rate: Number(runtime.message_rate || 0),
    uptime_seconds: Number(runtime.uptime_seconds || 0),
  };
}

function serializeBotState(botState) {
  const connected = getConnectedState(botState);
  const runtime = normalizeRuntime(botState.runtime);

  return {
    connected,
    last_heartbeat_at: botState.lastHeartbeatAt || null,
    ...runtime,
  };
}

function createSystemController({ legacyStoreService, botState, appStoreService }) {
  return {
    getHealth(_req, res) {
      res.json({
        ...legacyStoreService.getHealth(),
        storage_mode: appStoreService.getStorageMode()
      });
    },

    getBotStatus(_req, res) {
      res.json({
        ...serializeBotState(botState),
        timestamp: Date.now()
      });
    },

    getTest(req, res) {
      res.json({
        ...legacyStoreService.getHealth(),
        authenticated: Boolean(req.viewer?.primary_role)
      });
    },

    receiveBotHeartbeat(req, res) {
      botState.connected = Boolean(req.body?.connected);
      botState.lastHeartbeatAt = Date.now();
      botState.runtime = normalizeRuntime(req.body?.runtime || botState.runtime || {});
      if (typeof botState.emit === 'function') {
        botState.emit('BOT_STATUS_UPDATED', serializeBotState(botState));
      }
      res.json({ success: true });
    }
  };
}

module.exports = {
  BOT_HEARTBEAT_TIMEOUT_MS,
  createSystemController,
  serializeBotState
};
