import { Badge } from './ui/badge';
import { getRoleLabel } from '../lib/access';

const roleVariant = {
  super_admin: 'danger',
  leader: 'warning',
  deputy: 'default',
  high_command: 'success',
  fam_member: 'neutral',
};

export default function RoleBadge({ role, className = '' }) {
  if (!role) return null;
  return (
    <Badge variant={roleVariant[role] || 'neutral'} className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${className}`}>
      {getRoleLabel(role)}
    </Badge>
  );
}
