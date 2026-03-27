const { WEBSITE_ROLES } = require('./roles');

const PERMISSIONS = Object.freeze({
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_NOTIFICATIONS: 'view_notifications',
  VIEW_PROFILE: 'view_profile',
  VIEW_ACTIVITY: 'view_activity',
  VIEW_LEADERBOARD: 'view_leaderboard',
  VIEW_SELF_STRIKES: 'view_self_strikes',
  VIEW_USERS: 'view_users',
  VIEW_EVENTS: 'view_events',
  CREATE_EVENTS: 'create_events',
  EDIT_EVENTS: 'edit_events',
  TOGGLE_EVENTS: 'toggle_events',
  DELETE_EVENTS: 'delete_events',
  VIEW_WELCOME: 'view_welcome',
  MANAGE_WELCOME: 'manage_welcome',
  VIEW_LOGS: 'view_logs',
  MANAGE_LOGS: 'manage_logs',
  VIEW_DISCORD_LOGS: 'view_discord_logs',
  MANAGE_DISCORD_LOGS: 'manage_discord_logs',
  VIEW_AUTOROLE: 'view_autorole',
  MANAGE_AUTOROLE: 'manage_autorole',
  VIEW_STRIKE_REQUESTS: 'view_strike_requests',
  APPLY_STRIKES: 'apply_strikes',
  REVIEW_STRIKES: 'review_strikes',
  ISSUE_STRIKES: 'issue_strikes',
  REVOKE_STRIKES: 'revoke_strikes',
  CLEAR_STRIKE_HISTORY: 'clear_strike_history',
  MANAGE_STRIKE_CONFIG: 'manage_strike_config',
  RESET_ACTIVITY: 'reset_activity',
  CONFIGURE_FAM_ROLE: 'configure_fam_role',
  MANAGE_WEB_ROLES: 'manage_web_roles',
  ELECT_LEADER: 'elect_leader',
  MANAGE_BOT_CHAT: 'manage_bot_chat'
});

const PERMISSIONS_BY_ROLE = Object.freeze({
  [WEBSITE_ROLES.FAM_MEMBER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.VIEW_PROFILE,
    PERMISSIONS.VIEW_ACTIVITY,
    PERMISSIONS.VIEW_LEADERBOARD,
    PERMISSIONS.VIEW_SELF_STRIKES
  ],
  [WEBSITE_ROLES.HIGH_COMMAND]: [
    PERMISSIONS.VIEW_USERS,
    PERMISSIONS.VIEW_EVENTS,
    PERMISSIONS.CREATE_EVENTS,
    PERMISSIONS.TOGGLE_EVENTS,
    PERMISSIONS.VIEW_STRIKE_REQUESTS,
    PERMISSIONS.APPLY_STRIKES
  ],
  [WEBSITE_ROLES.DEPUTY]: [
    PERMISSIONS.EDIT_EVENTS,
    PERMISSIONS.DELETE_EVENTS,
    PERMISSIONS.VIEW_WELCOME,
    PERMISSIONS.MANAGE_WELCOME,
    PERMISSIONS.VIEW_LOGS,
    PERMISSIONS.MANAGE_LOGS,
    PERMISSIONS.VIEW_DISCORD_LOGS,
    PERMISSIONS.MANAGE_DISCORD_LOGS,
    PERMISSIONS.VIEW_AUTOROLE,
    PERMISSIONS.MANAGE_AUTOROLE,
    PERMISSIONS.REVIEW_STRIKES,
    PERMISSIONS.ISSUE_STRIKES,
    PERMISSIONS.REVOKE_STRIKES,
    PERMISSIONS.MANAGE_STRIKE_CONFIG,
    PERMISSIONS.RESET_ACTIVITY,
    PERMISSIONS.CONFIGURE_FAM_ROLE,
    PERMISSIONS.MANAGE_WEB_ROLES
  ],
  [WEBSITE_ROLES.LEADER]: [
    PERMISSIONS.ELECT_LEADER
  ],
  [WEBSITE_ROLES.SUPER_ADMIN]: [
    PERMISSIONS.ELECT_LEADER
  ]
});

function resolvePermissions(role) {
  const permissionSet = new Set();
  const order = [
    WEBSITE_ROLES.FAM_MEMBER,
    WEBSITE_ROLES.HIGH_COMMAND,
    WEBSITE_ROLES.DEPUTY,
    WEBSITE_ROLES.LEADER,
    WEBSITE_ROLES.SUPER_ADMIN
  ];
  const maxIndex = order.indexOf(role);

  if (maxIndex === -1) {
    return [];
  }

  for (let index = 0; index <= maxIndex; index += 1) {
    for (const permission of PERMISSIONS_BY_ROLE[order[index]] || []) {
      permissionSet.add(permission);
    }
  }

  if (role === WEBSITE_ROLES.SUPER_ADMIN) {
    for (const key of Object.values(PERMISSIONS)) {
      permissionSet.add(key);
    }
  }

  return Array.from(permissionSet);
}

module.exports = {
  PERMISSIONS,
  PERMISSIONS_BY_ROLE,
  resolvePermissions
};
