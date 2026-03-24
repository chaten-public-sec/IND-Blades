const { WEBSITE_ROLES, ROLE_LABELS } = require('../constants/roles');

function enrichUsersWithWebsiteRoles(users, settings, managedUsers, superAdminIds, roleService) {
  const managedMap = new Map(managedUsers.map((item) => [String(item.discord_id), item.assigned_role]));
  const superAdminSet = new Set(superAdminIds.map(String));
  const famRoleId = settings.fam_discord_role_id ? String(settings.fam_discord_role_id) : null;

  return users.map((user) => {
    const manualRole = superAdminSet.has(String(user.id))
      ? WEBSITE_ROLES.SUPER_ADMIN
      : (managedMap.get(String(user.id)) || null);
    const famMember = Boolean(famRoleId && Array.isArray(user.roles) && user.roles.map(String).includes(famRoleId));
    const websiteRoles = roleService.buildRoleList({ famMember, managementRole: manualRole });
    const primaryRole = roleService.resolvePrimaryRole(websiteRoles);

    return {
      ...user,
      website_roles: websiteRoles,
      primary_role: primaryRole,
      primary_role_label: primaryRole ? ROLE_LABELS[primaryRole] : null,
      fam_member: famMember
    };
  });
}

function createDashboardController({
  legacyStoreService,
  discordService,
  roleService,
  appStoreService,
  notificationService,
  botState,
  logService
}) {
  return {
    async bootstrap(req, res) {
      const store = legacyStoreService.readStore();
      const activity = legacyStoreService.getActivityStats(store);
      const [channels, roles, rawUsers, settings, managedUsers, superAdminIds, notificationCenter] = await Promise.all([
        discordService.getChannels(),
        discordService.getRoles(),
        discordService.getUsers(activity, legacyStoreService),
        appStoreService.getSettings(),
        appStoreService.listManagedUsers(),
        roleService.getSuperAdminIds(),
        notificationService.listForUser(req.viewer.id)
      ]);

      const users = enrichUsersWithWebsiteRoles(rawUsers, settings, managedUsers, superAdminIds, roleService);
      const strikeRequests = await appStoreService.listStrikeRequests();
      const visibleStrikeRequests = req.viewer.permissions.includes('review_strikes')
        ? strikeRequests
        : strikeRequests.filter((item) => String(item.requester_user_id) === String(req.viewer.id));

      res.json({
        viewer: req.viewer,
        health: legacyStoreService.getHealth(),
        bot_status: botState.connected ? 'connected' : 'disconnected',
        storage_mode: appStoreService.getStorageMode(),
        events: legacyStoreService.listEvents(store),
        welcome: legacyStoreService.getWelcomeConfig(store),
        log_settings: legacyStoreService.getLogSettings(store),
        discord_logs: legacyStoreService.getDiscordLogsConfig(store),
        activity,
        activity_config: legacyStoreService.getActivityConfig(store),
        autorole: legacyStoreService.getAutoRoleConfig(store),
        notification_settings: legacyStoreService.getNotificationConfig(store),
        strike_config: legacyStoreService.getStrikeConfig(store),
        logs: req.viewer.permissions.includes('view_logs') ? logService.getLogs() : [],
        users,
        channels,
        roles,
        notification_center: notificationCenter,
        strike_requests: visibleStrikeRequests,
        management: {
          settings,
          assignments: managedUsers
        }
      });
    },

    async listChannels(_req, res) {
      res.json(await discordService.getChannels());
    },

    async listRoles(_req, res) {
      res.json(await discordService.getRoles());
    },

    async listUsers(_req, res) {
      const activity = legacyStoreService.getActivityStats();
      const [settings, managedUsers, superAdminIds] = await Promise.all([
        appStoreService.getSettings(),
        appStoreService.listManagedUsers(),
        roleService.getSuperAdminIds()
      ]);
      const rawUsers = await discordService.getUsers(activity, legacyStoreService);
      res.json(enrichUsersWithWebsiteRoles(rawUsers, settings, managedUsers, superAdminIds, roleService));
    },

    async getUser(req, res) {
      const activity = legacyStoreService.getActivityStats();
      const rawUsers = await discordService.getUsers(activity, legacyStoreService);
      const target = rawUsers.find((item) => String(item.id) === String(req.params.id));
      if (!target) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      res.json(target);
    },

    getUserStrikes(req, res) {
      res.json(legacyStoreService.getUserStrikes(req.params.id));
    }
  };
}

module.exports = {
  createDashboardController
};
