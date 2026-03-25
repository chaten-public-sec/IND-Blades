class NotificationService {
  constructor({ appStoreService, roleService, io }) {
    this.appStoreService = appStoreService;
    this.roleService = roleService;
    this.io = io;
  }

  emitToUser(userId, type, payload) {
    if (!this.io) {
      return;
    }
    this.io.to(`user:${userId}`).emit('systemUpdate', { type, payload });
  }

  async listForUser(userId) {
    const rows = await this.appStoreService.listNotificationsForUser(userId);
    return rows.map((row) => ({
      ...row,
      read: Boolean(row.read_at)
    }));
  }

  async createForUsers(userIds, spec) {
    const targets = Array.from(new Set((userIds || []).map(String).filter(Boolean)));
    if (targets.length === 0) {
      return [];
    }

    const docs = await this.appStoreService.createNotifications(
      targets.map((targetUserId) => ({
        target_user_id: targetUserId,
        actor_user_id: spec.actor_user_id || null,
        type: spec.type || 'system',
        title: spec.title || 'Notification',
        message: spec.message || '',
        meta: spec.meta || {}
      }))
    );

    for (const doc of docs) {
      this.emitToUser(doc.target_user_id, 'NOTIFICATION_CREATED', { notification: doc });
    }

    return docs;
  }

  async markRead(notificationId, userId) {
    await this.appStoreService.markNotificationRead(notificationId, userId);
    this.emitToUser(String(userId), 'NOTIFICATIONS_UPDATED', {});
  }

  async markAllRead(userId) {
    await this.appStoreService.markAllNotificationsRead(userId);
    this.emitToUser(String(userId), 'NOTIFICATIONS_UPDATED', {});
  }

  async dismiss(notificationId, userId) {
    await this.appStoreService.deleteNotification(notificationId, userId);
    this.emitToUser(String(userId), 'NOTIFICATIONS_UPDATED', {});
  }

  async dismissAll(userId) {
    await this.appStoreService.clearNotifications(userId);
    this.emitToUser(String(userId), 'NOTIFICATIONS_UPDATED', {});
  }

  async notifyEscalation(actor, title, message, meta = {}) {
    const recipients = await this.roleService.getEscalationRecipients(actor.primary_role);
    const filtered = recipients.filter((userId) => String(userId) !== String(actor.id));
    return this.createForUsers(filtered, {
      actor_user_id: actor.id,
      type: 'management_update',
      title,
      message,
      meta
    });
  }
}

module.exports = {
  NotificationService
};
