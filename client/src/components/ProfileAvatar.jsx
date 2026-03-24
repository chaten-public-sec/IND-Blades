import { cn } from '../lib/cn';
import { initials } from '../lib/format';

const sizeClasses = {
  sm: 'h-9 w-9 rounded-[14px] text-xs',
  md: 'h-10 w-10 rounded-[16px] text-sm',
  lg: 'h-14 w-14 rounded-[18px] text-base',
  xl: 'h-24 w-24 rounded-[28px] text-2xl',
};

export default function ProfileAvatar({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}) {
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const fallback = initials(name || 'IB');

  return (
    <div className={cn(`flex shrink-0 items-center justify-center overflow-hidden bg-[var(--primary-soft)] font-bold text-[var(--text-main)] ${sizeClass}`, className)}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={name || 'Profile avatar'}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}
