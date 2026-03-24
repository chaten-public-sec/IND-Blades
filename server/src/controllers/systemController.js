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
        connected: botState.connected,
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
      if (typeof botState.emit === 'function') {
        botState.emit('BOT_STATUS_UPDATED', { connected: botState.connected });
      }
      res.json({ success: true });
    }
  };
}

module.exports = {
  createSystemController
};
