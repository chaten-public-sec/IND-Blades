function createLegacyController({
  legacyStoreService,
  logService,
  commandQueueService,
  emitSystemUpdate,
  notificationService
}) {
  return {
    getEvents(_req, res) {
      res.json(legacyStoreService.listEvents());
    },

    async createEvent(req, res) {
      const result = legacyStoreService.createEvent(req.body || {});
      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }

      commandQueueService.enqueueCommand('event_created', { event: result.event });
      emitSystemUpdate('EVENT_CREATED', { event: result.event });
      logService.appendLog(`Created event "${result.event.desc}".`, 'info', 'events', { id: result.event.id });

      if (req.viewer) {
        await notificationService.notifyEscalation(
          req.viewer,
          'Event Created',
          `${req.viewer.display_name} created "${result.event.desc}".`,
          { event_id: result.event.id }
        );
      }

      res.json({ success: true, event: result.event });
    },

    async updateEvent(req, res) {
      const id = String(req.body?.id || '').trim();
      if (!id) {
        res.status(400).json({ error: 'Choose an event to update.' });
        return;
      }

      const result = legacyStoreService.updateEvent(id, req.body || {});
      if (result.error) {
        res.status(result.code || 400).json({ error: result.error });
        return;
      }

      commandQueueService.enqueueCommand('event_updated', { event: result.event });
      emitSystemUpdate('EVENT_UPDATED', { event: result.event });
      logService.appendLog(`Updated event "${result.event.desc}".`, 'info', 'events', { id });

      if (req.viewer) {
        await notificationService.notifyEscalation(
          req.viewer,
          'Event Updated',
          `${req.viewer.display_name} updated "${result.event.desc}".`,
          { event_id: id }
        );
      }

      res.json({ success: true, event: result.event });
    },

    async toggleEvent(req, res) {
      const id = String(req.body?.id || '').trim();
      if (!id) {
        res.status(400).json({ error: 'Choose an event first.' });
        return;
      }

      const result = legacyStoreService.toggleEvent(id, req.body?.enabled);
      if (result.error) {
        res.status(result.code || 400).json({ error: result.error });
        return;
      }

      const toggleType = result.event.enabled ? 'EVENT_RESUMED' : 'EVENT_PAUSED';
      commandQueueService.enqueueCommand(result.event.enabled ? 'event_resumed' : 'event_paused', { event: result.event });
      emitSystemUpdate(toggleType, { event: result.event });
      logService.appendLog(`${result.event.enabled ? 'Enabled' : 'Disabled'} event "${result.event.desc}".`, 'info', 'events', { id });

      if (req.viewer) {
        await notificationService.notifyEscalation(
          req.viewer,
          'Event Toggled',
          `${req.viewer.display_name} ${result.event.enabled ? 'enabled' : 'disabled'} "${result.event.desc}".`,
          { event_id: id, enabled: result.event.enabled }
        );
      }

      res.json({ success: true, event: result.event });
    },

    async deleteEvent(req, res) {
      const id = String(req.body?.id || '').trim();
      if (!id) {
        res.status(400).json({ error: 'Choose an event first.' });
        return;
      }

      const result = legacyStoreService.deleteEvent(id);
      if (result.error) {
        res.status(result.code || 400).json({ error: result.error });
        return;
      }

      commandQueueService.enqueueCommand('event_deleted', { id, name: result.event.desc });
      emitSystemUpdate('EVENT_DELETED', { id, name: result.event.desc });
      logService.appendLog(`Deleted event "${result.event.desc}".`, 'warning', 'events', { id });

      if (req.viewer) {
        await notificationService.notifyEscalation(
          req.viewer,
          'Event Deleted',
          `${req.viewer.display_name} deleted "${result.event.desc}".`,
          { event_id: id }
        );
      }

      res.json({ success: true, event: result.event });
    },

    getWelcome(_req, res) {
      res.json(legacyStoreService.getWelcomeConfig());
    },

    postWelcomeToggle(req, res) {
      const config = legacyStoreService.setWelcomeConfig({ enabled: req.body?.enabled });
      emitSystemUpdate('WELCOME_UPDATED', { config });
      logService.appendLog(`Welcome panel ${config.enabled ? 'enabled' : 'disabled'}.`, 'info', 'welcome');
      res.json({ success: true, config });
    },

    postWelcomeChannel(req, res) {
      const config = legacyStoreService.setWelcomeConfig({ channel_id: req.body?.channel_id });
      emitSystemUpdate('WELCOME_UPDATED', { config });
      logService.appendLog('Welcome channel updated.', 'info', 'welcome', { channel_id: config.channel_id });
      res.json({ success: true, config });
    },

    postWelcomeContent(req, res) {
      const config = legacyStoreService.setWelcomeConfig({
        title: req.body?.title,
        message: req.body?.message,
        image_url: req.body?.image_url,
        gif_url: req.body?.gif_url,
        accent_color: req.body?.accent_color
      });
      emitSystemUpdate('WELCOME_UPDATED', { config });
      logService.appendLog('Welcome content updated.', 'info', 'welcome');
      res.json({ success: true, config });
    },

    postWelcomePreview(req, res) {
      const channelId = String(req.body?.channel_id || legacyStoreService.getWelcomeConfig().channel_id || '').trim();
      if (!channelId) {
        res.status(400).json({ error: 'Choose a welcome channel before previewing.' });
        return;
      }

      commandQueueService.enqueueCommand('welcome_preview', {
        channel_id: channelId,
        title: req.body?.title,
        message: req.body?.message,
        image_url: req.body?.image_url,
        gif_url: req.body?.gif_url,
        accent_color: req.body?.accent_color
      });
      logService.appendLog('Queued welcome preview.', 'info', 'welcome', { channel_id: channelId });
      res.json({ success: true });
    },

    getLogSettings(_req, res) {
      res.json(legacyStoreService.getLogSettings());
    },

    postLogSettings(req, res) {
      const config = legacyStoreService.setLogSettings(req.body || {});
      emitSystemUpdate('LOG_SETTINGS_UPDATED', { config });
      logService.appendLog('Updated server log routing.', 'info', 'logs', config);
      res.json({ success: true, config });
    },

    getDiscordLogs(_req, res) {
      res.json(legacyStoreService.getDiscordLogsConfig());
    },

    postDiscordLogs(req, res) {
      const config = legacyStoreService.setDiscordLogsConfig(req.body || {});
      emitSystemUpdate('DISCORD_LOGS_UPDATED', { config });
      logService.appendLog('Updated Discord log settings.', 'info', 'discord_logs');
      res.json({ success: true, config });
    },

    getActivityStats(_req, res) {
      res.json(legacyStoreService.getActivityStats());
    },

    getActivityConfig(_req, res) {
      res.json(legacyStoreService.getActivityConfig());
    },

    postActivityConfig(req, res) {
      const config = legacyStoreService.setActivityConfig(req.body || {});
      emitSystemUpdate('ACTIVITY_CONFIG_UPDATED', { config });
      logService.appendLog('Updated activity settings.', 'info', 'activity');
      res.json({ success: true, config });
    },

    postActivityReset(req, res) {
      const activity = legacyStoreService.resetActivityStats();
      emitSystemUpdate('ACTIVITY_RESET', { activity });
      logService.appendLog('Reset weekly activity stats.', 'warning', 'activity');
      res.json({ success: true, activity });
    },

    getLogs(_req, res) {
      res.json(logService.getLogs());
    },

    postClearLogs(_req, res) {
      logService.clearLogs();
      emitSystemUpdate('LOG_UPDATED', {});
      res.json({ success: true });
    },

    getAutoRole(_req, res) {
      res.json(legacyStoreService.getAutoRoleConfig());
    },

    postAutoRole(req, res) {
      const config = legacyStoreService.setAutoRoleConfig(req.body || {});
      emitSystemUpdate('AUTOROLE_UPDATED', { config });
      logService.appendLog('Updated auto role settings.', 'info', 'autorole');
      res.json({ success: true, config });
    },

    getNotificationSettings(_req, res) {
      res.json(legacyStoreService.getNotificationConfig());
    },

    postNotificationSettings(req, res) {
      const config = legacyStoreService.setNotificationConfig(req.body || {});
      emitSystemUpdate('NOTIFICATION_SETTINGS_UPDATED', { config });
      logService.appendLog('Updated notification settings.', 'info', 'notifications');
      res.json({ success: true, config });
    },

    getVcConfig(_req, res) {
      res.json(legacyStoreService.getVcConfig());
    },

    postVcConfig(req, res) {
      const config = legacyStoreService.setVcConfig(req.body || {});
      emitSystemUpdate('VC_CONFIG_UPDATED', { config });
      res.json({ success: true, config });
    }
  };
}

module.exports = {
  createLegacyController
};
