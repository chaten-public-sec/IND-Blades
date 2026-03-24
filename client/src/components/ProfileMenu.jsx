import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, Moon, Settings, Sun, User } from 'lucide-react';
import { Button } from './ui/button';
import { hasPermission } from '../lib/access';
import RoleBadge from './RoleBadge';
import ProfileAvatar from './ProfileAvatar';

export default function ProfileMenu({ open, onClose, onMyProfile, dashboard, theme, toggleTheme }) {
  const ref = useRef(null);
  const navigate = useNavigate();
  const canOpenSettings = hasPermission(dashboard.viewer, 'view_autorole') || hasPermission(dashboard.viewer, 'configure_fam_role');
  const canOpenProfile = Boolean(dashboard.viewer?.primary_role);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className="absolute right-0 top-[calc(100%+12px)] z-[80] w-72 rounded-[24px] border border-[var(--border)] bg-[var(--bg-panel)] p-2 shadow-[0_22px_60px_-26px_rgba(2,6,23,0.88)] backdrop-blur-xl">
      <div className="border-b border-[var(--border)] px-3 py-3">
        <div className="flex items-center gap-3">
          <ProfileAvatar
            name={dashboard.selfProfile?.name || dashboard.viewer.display_name}
            avatarUrl={dashboard.selfProfile?.avatar_url || dashboard.viewer.avatar_url}
            size="lg"
          />
          <div>
            <p className="text-sm font-semibold text-[var(--text-main)]">{dashboard.viewer.display_name}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">@{dashboard.viewer.username}</p>
          </div>
        </div>
        <div className="mt-3">
          <RoleBadge role={dashboard.viewer.primary_role} />
        </div>
      </div>

      <div className="mt-2 space-y-1">
        {canOpenProfile ? (
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onMyProfile?.();
              onClose();
            }}
          >
            <User className="h-4 w-4" />
            My Profile
          </Button>
        ) : null}
        {canOpenSettings ? (
          <Button
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              navigate('/dashboard/autorole');
              onClose();
            }}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        ) : null}
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={() => {
            toggleTheme();
            onClose();
          }}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          Theme Toggle
        </Button>
      </div>

      <div className="mt-2 border-t border-[var(--border)] pt-2">
        <Button
          variant="ghost"
          className="w-full justify-start text-rose-300 hover:text-rose-200"
          onClick={() => {
            onClose();
            dashboard.logout();
          }}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
