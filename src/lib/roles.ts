export const ALL_ROLES = [
  'Nô lệ',
  'Thành viên',
  'Kiểm duyệt viên',
  'Phó Admin',
  'Admin',
  'Sáng lập viên',
] as const;

export const ROLE_RANK: Record<string, number> = {
  'Nô lệ': -1,
  'Thành viên': 0,
  'Kiểm duyệt viên': 1,
  'Phó Admin': 2,
  'Admin': 3,
  'Sáng lập viên': 4,
};

export function canManageUsers(role: string): boolean {
  return ROLE_RANK[role] >= ROLE_RANK['Phó Admin'];
}

// Phó Admin trở lên mới được dùng lệnh "cấm chat" (mute)
export function canMuteUsers(role: string): boolean {
  return ROLE_RANK[role] >= ROLE_RANK['Phó Admin'];
}

// Phó Admin trở lên mới được cấm tài khoản vĩnh viễn (ban)
export function canBanUsers(role: string): boolean {
  return ROLE_RANK[role] >= ROLE_RANK['Phó Admin'];
}

export const MUTE_DURATION_MS = 60 * 60 * 1000; // 60 phút

export function isUserMuted(mutedUntil: string | null | undefined): boolean {
  if (!mutedUntil) return false;
  return new Date(mutedUntil).getTime() > Date.now();
}

export function muteRemainingMinutes(mutedUntil: string | null | undefined): number {
  if (!mutedUntil) return 0;
  const ms = new Date(mutedUntil).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 60000));
}

interface RoleColor {
  text: string;
  bg: string;
  dot: string;
  badge: string;
}

export const ROLE_COLORS: Record<string, RoleColor> = {
  'Nô lệ': {
    text: 'text-slate-500 dark:text-slate-400',
    bg: 'bg-slate-200 dark:bg-slate-700/30',
    dot: 'bg-slate-400',
    badge: 'bg-slate-200 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  },
  'Thành viên': {
    text: 'text-pink-600 dark:text-pink-400',
    bg: 'bg-pink-100 dark:bg-pink-500/15',
    dot: 'bg-pink-400',
    badge: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300',
  },
  'Kiểm duyệt viên': {
    text: 'text-cyan-600 dark:text-cyan-400',
    bg: 'bg-cyan-100 dark:bg-cyan-500/15',
    dot: 'bg-cyan-400',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
  },
  'Phó Admin': {
    text: 'text-violet-600 dark:text-violet-400',
    bg: 'bg-violet-100 dark:bg-violet-500/15',
    dot: 'bg-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
  },
  'Admin': {
    text: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    dot: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
  },
  'Sáng lập viên': {
    text: 'text-rose-600 dark:text-rose-400',
    bg: 'bg-rose-100 dark:bg-rose-500/15',
    dot: 'bg-rose-400',
    badge: 'bg-gradient-to-r from-rose-500 to-pink-500 text-white',
  },
};
