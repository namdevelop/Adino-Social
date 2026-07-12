import { ROLE_COLORS } from '../lib/roles';
import type { Profile } from '../lib/types';

export default function Avatar({
  profile,
  size = 40,
  showBadge = false,
}: {
  profile: Profile | null | undefined;
  size?: number;
  showBadge?: boolean;
}) {
  const colors = ROLE_COLORS[profile?.role ?? 'Thành viên'] ?? ROLE_COLORS['Thành viên'];
  const initials = (profile?.username ?? '?').slice(0, 2).toUpperCase();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {profile?.avatar_url ? (
        <img
          src={profile.avatar_url}
          alt={profile.username}
          className="rounded-full object-cover ring-2 ring-pink-300/50 dark:ring-fuchsia-500/40"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-bold text-white ring-2 ring-pink-300/50 dark:ring-fuchsia-500/40"
          style={{
            width: size,
            height: size,
            fontSize: size * 0.35,
            background: 'linear-gradient(135deg, #ec4899, #a855f7)',
          }}
        >
          {initials}
        </div>
      )}
      {showBadge && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 rounded-full border-2 border-white dark:border-slate-900 ${colors.dot}`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
