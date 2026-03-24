export const ROLE_LABELS = {
  super_admin: 'Super Admin',
  leader: 'Leader',
  deputy: 'Deputy',
  high_command: 'High Command',
  fam_member: 'Fam Member',
};

export function getRoleLabel(role) {
  return ROLE_LABELS[role] || 'Guest';
}

export function hasPermission(viewer, permission) {
  return Boolean(viewer?.permissions?.includes(permission));
}

export function hasRole(viewer, roles) {
  const roleList = Array.isArray(roles) ? roles : [roles];
  return roleList.includes(viewer?.primary_role);
}
