import { useEffect, useState } from 'react';
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
  const [imageFailed, setImageFailed] = useState(false);
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const fallback = initials(name || 'IB');
  const hasImage = Boolean(avatarUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [avatarUrl]);

  return (
    <div
      className={cn(
        `flex shrink-0 items-center justify-center overflow-hidden border border-[var(--border)] bg-[linear-gradient(135deg,rgba(var(--primary-rgb),0.22),rgba(255,255,255,0.04))] font-bold text-[var(--text-main)] shadow-[0_12px_30px_-20px_rgba(15,23,42,0.75)] ${sizeClass}`,
        className
      )}
    >
      {hasImage ? (
        <img
          src={avatarUrl}
          alt={name || 'Profile avatar'}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="text-current">{fallback}</span>
      )}
    </div>
  );
}
