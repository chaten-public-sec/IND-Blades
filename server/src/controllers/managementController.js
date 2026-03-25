const { PERMISSIONS } = require('../constants/permissions');
const { WEBSITE_ROLES } = require('../constants/roles');

function createManagementController({
  appStoreService,
  roleService,
  notificationService,
  emitSystemUpdate,
  logService
}) {
  return {
    async getSettings(_req, res) {
      res.json(await appStoreService.getSettings());
    },

    async updateSettings(req, res) {
      const partial = {};
      if (Object.prototype.hasOwnProperty.call(req.body || {}, 'fam_discord_role_id')) {
        partial.fam_discord_role_id = req.body?.fam_discord_role_id;
      }

      const settings = await appStoreService.updateSettings(partial);
      emitSystemUpdate('MANAGEMENT_SETTINGS_UPDATED', { settings });
      logService.appendLog('Updated management settings.', 'info', 'management');
      res.json({ success: true, settings });
    },

    async listAssignments(_req, res) {
      res.json(await roleService.listManagementAssignments());
    },

    async assignRole(req, res) {
      const targetUserId = String(req.body?.user_id || '').trim();
      const targetRole = String(req.body?.role || '').trim();
      const notes = String(req.body?.notes || '');

      if (!targetUserId || !targetRole) {
        res.status(400).json({ error: 'Choose a user and a role.' });
        return;
      }

      const result = await roleService.assignManagedRole({
        actor: req.viewer,
        targetUserId,
        targetRole,
        notes
      });

      if (result.error) {
        res.status(result.code || 400).json({ error: result.error });
        return;
      }

      emitSystemUpdate('ROLE_UPDATED', { assignment: result.assignment });
      logService.appendLog(`Assigned ${targetRole} role to ${targetUserId}.`, 'info', 'management', { target_user_id: targetUserId, role: targetRole });

      await notificationService.createForUsers([targetUserId], {
        actor_user_id: req.viewer.id,
        type: 'role_assignment',
        title: 'Website Role Updated',
        message: `${req.viewer.display_name} assigned you the ${targetRole.replace('_', ' ')} role.`,
        meta: { role: targetRole }
      });

      res.json({ success: true, assignment: result.assignment });
    },

    async clearRole(req, res) {
      const targetUserId = String(req.body?.user_id || '').trim();
      if (!targetUserId) {
        res.status(400).json({ error: 'Choose a user first.' });
        return;
      }

      const result = await roleService.clearManagedRole({
        actor: req.viewer,
        targetUserId
      });

      if (result.error) {
        res.status(result.code || 400).json({ error: result.error });
        return;
      }

      emitSystemUpdate('ROLE_UPDATED', { user_id: targetUserId });
      logService.appendLog(`Removed managed website role from ${targetUserId}.`, 'warning', 'management', { target_user_id: targetUserId });

      await notificationService.createForUsers([targetUserId], {
        actor_user_id: req.viewer.id,
        type: 'role_assignment',
        title: 'Website Role Removed',
        message: `${req.viewer.display_name} removed your managed website role.`,
        meta: {}
      });

      res.json({ success: true, assignment: result.assignment });
    },

    async listNotifications(req, res) {
      res.json(await notificationService.listForUser(req.viewer.id));
    },

    async markNotificationRead(req, res) {
      await notificationService.markRead(req.params.id, req.viewer.id);
      res.json({ success: true });
    },

    async markAllNotificationsRead(req, res) {
      await notificationService.markAllRead(req.viewer.id);
      res.json({ success: true });
    },

    async dismissNotification(req, res) {
      await notificationService.dismiss(req.params.id, req.viewer.id);
      res.json({ success: true });
    },

    async dismissAllNotifications(req, res) {
      await notificationService.dismissAll(req.viewer.id);
      res.json({ success: true });
    }
  };
}

module.exports = {
  createManagementController
};
