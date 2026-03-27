const { getListEnv } = require('../config/env');
const { WEBSITE_ROLES, MANAGEMENT_ROLES, ROLE_PRIORITY, ROLE_LABELS } = require('../constants/roles');
const { resolvePermissions } = require('../constants/permissions');

class RoleService {
  constructor({ appStoreService, discordService }) {
    this.appStoreService = appStoreService;
    this.discordService = discordService;
  }

  getConfiguredSuperAdminIds() {
    return getListEnv('SUPER_ADMIN_IDS').map(String);
  }

  async getSuperAdminIds() {
    const envAdmins = this.getConfiguredSuperAdminIds();
    if (envAdmins.length > 0) {
      return Array.from(new Set(envAdmins));
    }

    const settings = await this.appStoreService.getSettings();
    return Array.from(new Set((settings.super_admin_ids || []).map(String)));
  }

  async ensureBootstrappedSuperAdmin(discordId) {
    const envAdmins = this.getConfiguredSuperAdminIds();
    if (envAdmins.length > 0) {
      return;
    }

    const settings = await this.appStoreService.getSettings();
    const current = settings.super_admin_ids || [];
    if (current.length > 0) {
      return;
    }

    await this.appStoreService.updateSettings({
      super_admin_ids: [String(discordId)]
    });
  }

  async resolveManagementRole(discordId) {
    const targetId = String(discordId);
    const superAdmins = await this.getSuperAdminIds();
    if (superAdmins.includes(targetId)) {
      return WEBSITE_ROLES.SUPER_ADMIN;
    }

    const managedUser = await this.appStoreService.getManagedUser(targetId);
    return MANAGEMENT_ROLES.includes(managedUser?.assigned_role) ? managedUser.assigned_role : null;
  }

  buildRoleList({ famMember, managementRole }) {
    const roles = [];
    if (managementRole) {
      roles.push(managementRole);
    }
    if (famMember) {
      roles.push(WEBSITE_ROLES.FAM_MEMBER);
    }

    return roles.sort((left, right) => ROLE_PRIORITY.indexOf(left) - ROLE_PRIORITY.indexOf(right));
  }

  resolvePrimaryRole(roles) {
    for (const role of ROLE_PRIORITY) {
      if (roles.includes(role)) {
        return role;
      }
    }
    return null;
  }

  async resolveViewerProfile(discordUser, guildMember) {
    const settings = await this.appStoreService.getSettings();
    const managementRole = await this.resolveManagementRole(discordUser.id);
    const famRoleId = settings.fam_discord_role_id;
    const guildRoles = Array.isArray(guildMember?.roles) ? guildMember.roles.map(String) : [];
    const famMember = Boolean(
      guildMember &&
      famRoleId &&
      guildRoles.includes(String(famRoleId))
    );
    const roles = this.buildRoleList({ famMember, managementRole });
    const primaryRole = this.resolvePrimaryRole(roles);
    const permissions = resolvePermissions(primaryRole);

    return {
      id: String(discordUser.id),
      username: discordUser.username || null,
      global_name: discordUser.global_name || null,
      display_name: guildMember?.nick || discordUser.global_name || discordUser.username || 'IND Member',
      avatar_url: this.discordService.resolveMemberAvatarUrl(guildMember, discordUser),
      guild_member: Boolean(guildMember),
      guild_nick: guildMember?.nick || null,
      guild_joined_at: guildMember?.joined_at || null,
      discord_role_ids: guildRoles,
      website_roles: roles,
      primary_role: primaryRole,
      primary_role_label: primaryRole ? ROLE_LABELS[primaryRole] : null,
      fam_member: famMember,
      permissions
    };
  }

  async resolveViewerByDiscordId(discordId) {
    const member = await this.discordService.fetchGuildMember(discordId);
    if (!member) {
      return null;
    }

    return this.resolveViewerProfile(member.user || { id: discordId }, member);
  }

  hasPermission(viewer, permission) {
    return Boolean(viewer?.permissions?.includes(permission));
  }

  assertPermission(viewer, permission) {
    return this.hasPermission(viewer, permission);
  }

  async listManagementAssignments() {
    const [superAdminIds, managedUsers] = await Promise.all([
      this.getSuperAdminIds(),
      this.appStoreService.listManagedUsers()
    ]);

    const rows = managedUsers.filter((item) => item.assigned_role);
    const knownIds = new Set(rows.map((item) => String(item.discord_id)));

    for (const adminId of superAdminIds) {
      if (knownIds.has(String(adminId))) {
        continue;
      }
      rows.push({
        discord_id: adminId,
        assigned_role: WEBSITE_ROLES.SUPER_ADMIN,
        assigned_by: null,
        assigned_at: null,
        notes: 'Bootstrap or env configured'
      });
    }

    return rows;
  }

  canAssignRole(actorRole, targetRole) {
    if (!targetRole || !MANAGEMENT_ROLES.includes(targetRole)) {
      return false;
    }

    if (actorRole === WEBSITE_ROLES.SUPER_ADMIN) {
      return true;
    }

    if (actorRole === WEBSITE_ROLES.LEADER) {
      return [WEBSITE_ROLES.DEPUTY, WEBSITE_ROLES.HIGH_COMMAND].includes(targetRole);
    }

    if (actorRole === WEBSITE_ROLES.DEPUTY) {
      return targetRole === WEBSITE_ROLES.HIGH_COMMAND;
    }

    return false;
  }

  async assignManagedRole({ actor, targetUserId, targetRole, notes }) {
    if (!this.canAssignRole(actor?.primary_role, targetRole)) {
      return { error: 'You do not have permission to assign that role.', code: 403 };
    }

    if (targetRole === WEBSITE_ROLES.LEADER) {
      const allAssignments = await this.appStoreService.listManagedUsers();
      const currentLeader = allAssignments.find((item) => item.assigned_role === WEBSITE_ROLES.LEADER);
      if (currentLeader && String(currentLeader.discord_id) !== String(targetUserId)) {
        await this.appStoreService.clearManagedRole(currentLeader.discord_id);
      }
    }

    const saved = await this.appStoreService.saveManagedUser({
      discord_id: String(targetUserId),
      assigned_role: targetRole,
      assigned_by: actor.id,
      assigned_at: new Date().toISOString(),
      notes: notes || ''
    });

    return { assignment: saved };
  }

  async clearManagedRole({ actor, targetUserId }) {
    const existing = await this.appStoreService.getManagedUser(targetUserId);
    if (!existing?.assigned_role) {
      return { error: 'That user does not have a managed website role.', code: 404 };
    }

    if (!this.canAssignRole(actor?.primary_role, existing.assigned_role)) {
      return { error: 'You do not have permission to remove that role.', code: 403 };
    }

    await this.appStoreService.clearManagedRole(targetUserId);
    return { success: true, assignment: existing };
  }

  async getEscalationRecipients(actorRole) {
    const superAdmins = await this.getSuperAdminIds();
    const managedUsers = await this.appStoreService.listManagedUsers();
    const byRole = {
      [WEBSITE_ROLES.SUPER_ADMIN]: superAdmins,
      [WEBSITE_ROLES.LEADER]: managedUsers.filter((item) => item.assigned_role === WEBSITE_ROLES.LEADER).map((item) => String(item.discord_id)),
      [WEBSITE_ROLES.DEPUTY]: managedUsers.filter((item) => item.assigned_role === WEBSITE_ROLES.DEPUTY).map((item) => String(item.discord_id)),
      [WEBSITE_ROLES.HIGH_COMMAND]: managedUsers.filter((item) => item.assigned_role === WEBSITE_ROLES.HIGH_COMMAND).map((item) => String(item.discord_id))
    };

    let recipients = [];

    if (actorRole === WEBSITE_ROLES.HIGH_COMMAND) {
      recipients = [...byRole[WEBSITE_ROLES.DEPUTY], ...byRole[WEBSITE_ROLES.LEADER], ...byRole[WEBSITE_ROLES.SUPER_ADMIN]];
    } else if (actorRole === WEBSITE_ROLES.DEPUTY) {
      recipients = [...byRole[WEBSITE_ROLES.LEADER], ...byRole[WEBSITE_ROLES.SUPER_ADMIN]];
    } else if (actorRole === WEBSITE_ROLES.LEADER) {
      recipients = [...byRole[WEBSITE_ROLES.SUPER_ADMIN]];
    }

    return Array.from(new Set(recipients.map(String)));
  }
}

module.exports = {
  RoleService
};
