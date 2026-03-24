const express = require('express');
const { PERMISSIONS } = require('../constants/permissions');
const { requirePermission } = require('../middlewares/requirePermission');

function createApiRouter({
  authService,
  roleService,
  authController,
  systemController,
  dashboardController,
  legacyController,
  managementController,
  strikesController
}) {
  const router = express.Router();

  router.get('/health', systemController.getHealth);
  router.get('/bot-status', systemController.getBotStatus);
  router.get('/test', systemController.getTest);
  router.post('/bot/heartbeat', systemController.receiveBotHeartbeat);

  router.get('/auth/session', authController.getSession);
  router.get('/auth/discord', authController.startDiscordLogin);
  router.get('/auth/discord/callback', authController.finishDiscordLogin);
  router.post('/auth/logout', authController.logout);

  router.use(authService.requireAuth);

  router.get('/dashboard/bootstrap', dashboardController.bootstrap);

  router.get('/channels', dashboardController.listChannels);
  router.get('/roles', dashboardController.listRoles);
  router.get('/users', dashboardController.listUsers);
  router.get('/users/:id', dashboardController.getUser);
  router.get('/users/:id/strikes', dashboardController.getUserStrikes);

  router.get('/notifications/center', managementController.listNotifications);
  router.post('/notifications/center/read-all', managementController.markAllNotificationsRead);
  router.post('/notifications/center/:id/read', managementController.markNotificationRead);

  router.get('/management/settings', requirePermission(PERMISSIONS.CONFIGURE_FAM_ROLE, roleService), managementController.getSettings);
  router.post('/management/settings', requirePermission(PERMISSIONS.CONFIGURE_FAM_ROLE, roleService), managementController.updateSettings);
  router.get('/management/roles', requirePermission(PERMISSIONS.MANAGE_WEB_ROLES, roleService), managementController.listAssignments);
  router.post('/management/roles/assign', requirePermission(PERMISSIONS.MANAGE_WEB_ROLES, roleService), managementController.assignRole);
  router.post('/management/roles/clear', requirePermission(PERMISSIONS.MANAGE_WEB_ROLES, roleService), managementController.clearRole);

  router.get('/events', requirePermission(PERMISSIONS.VIEW_EVENTS, roleService), legacyController.getEvents);
  router.post('/events/create', requirePermission(PERMISSIONS.CREATE_EVENTS, roleService), legacyController.createEvent);
  router.post('/events/update', requirePermission(PERMISSIONS.EDIT_EVENTS, roleService), legacyController.updateEvent);
  router.post('/events/toggle', requirePermission(PERMISSIONS.TOGGLE_EVENTS, roleService), legacyController.toggleEvent);
  router.post('/events/delete', requirePermission(PERMISSIONS.DELETE_EVENTS, roleService), legacyController.deleteEvent);

  router.get('/welcome', requirePermission(PERMISSIONS.VIEW_WELCOME, roleService), legacyController.getWelcome);
  router.post('/welcome/toggle', requirePermission(PERMISSIONS.MANAGE_WELCOME, roleService), legacyController.postWelcomeToggle);
  router.post('/welcome/channel', requirePermission(PERMISSIONS.MANAGE_WELCOME, roleService), legacyController.postWelcomeChannel);
  router.post('/welcome/preview', requirePermission(PERMISSIONS.MANAGE_WELCOME, roleService), legacyController.postWelcomePreview);

  router.get('/log-settings', requirePermission(PERMISSIONS.VIEW_LOGS, roleService), legacyController.getLogSettings);
  router.post('/log-settings', requirePermission(PERMISSIONS.MANAGE_LOGS, roleService), legacyController.postLogSettings);
  router.get('/discord-logs', requirePermission(PERMISSIONS.VIEW_DISCORD_LOGS, roleService), legacyController.getDiscordLogs);
  router.post('/discord-logs', requirePermission(PERMISSIONS.MANAGE_DISCORD_LOGS, roleService), legacyController.postDiscordLogs);
  router.get('/logs', requirePermission(PERMISSIONS.VIEW_LOGS, roleService), legacyController.getLogs);
  router.post('/logs/clear', requirePermission(PERMISSIONS.MANAGE_LOGS, roleService), legacyController.postClearLogs);

  router.get('/activity/stats', requirePermission(PERMISSIONS.VIEW_ACTIVITY, roleService), legacyController.getActivityStats);
  router.get('/activity/config', requirePermission(PERMISSIONS.VIEW_ACTIVITY, roleService), legacyController.getActivityConfig);
  router.post('/activity/config', requirePermission(PERMISSIONS.RESET_ACTIVITY, roleService), legacyController.postActivityConfig);
  router.post('/activity/reset', requirePermission(PERMISSIONS.RESET_ACTIVITY, roleService), legacyController.postActivityReset);

  router.get('/autorole', requirePermission(PERMISSIONS.VIEW_AUTOROLE, roleService), legacyController.getAutoRole);
  router.post('/autorole', requirePermission(PERMISSIONS.MANAGE_AUTOROLE, roleService), legacyController.postAutoRole);
  router.get('/notifications', requirePermission(PERMISSIONS.VIEW_DISCORD_LOGS, roleService), legacyController.getNotificationSettings);
  router.post('/notifications', requirePermission(PERMISSIONS.MANAGE_DISCORD_LOGS, roleService), legacyController.postNotificationSettings);
  router.get('/vc-config', requirePermission(PERMISSIONS.VIEW_DISCORD_LOGS, roleService), legacyController.getVcConfig);
  router.post('/vc-config', requirePermission(PERMISSIONS.MANAGE_DISCORD_LOGS, roleService), legacyController.postVcConfig);

  router.get('/strikes/config', requirePermission(PERMISSIONS.VIEW_SELF_STRIKES, roleService), strikesController.getStrikeConfig);
  router.post('/strikes/config', requirePermission(PERMISSIONS.MANAGE_STRIKE_CONFIG, roleService), strikesController.postStrikeConfig);
  router.post('/strikes/add', requirePermission(PERMISSIONS.ISSUE_STRIKES, roleService), strikesController.directIssue);
  router.post('/strikes/revoke', requirePermission(PERMISSIONS.REVOKE_STRIKES, roleService), strikesController.revoke);
  router.post('/strikes/clear-history', requirePermission(PERMISSIONS.CLEAR_STRIKE_HISTORY, roleService), strikesController.clearHistory);

  router.get('/strike-requests', requirePermission(PERMISSIONS.APPLY_STRIKES, roleService), strikesController.listRequests);
  router.post('/strike-requests', requirePermission(PERMISSIONS.APPLY_STRIKES, roleService), strikesController.createRequest);
  router.post('/strike-requests/:id/review', requirePermission(PERMISSIONS.REVIEW_STRIKES, roleService), strikesController.reviewRequest);

  router.use((_req, res) => {
    res.status(404).json({ error: 'That route does not exist.' });
  });

  return router;
}

module.exports = {
  createApiRouter
};
