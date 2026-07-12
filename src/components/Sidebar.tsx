import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import { ROLE_COLORS, canManageUsers } from '../lib/roles';
import Avatar from './Avatar';
import { Home, Users, User, LogOut, Sparkles, X, MessageCircle, Shield, Sun, Moon } from 'lucide-react';
import type { Page } from '../App';

export default function Sidebar({
  current, onNavigate, open, onClose,
}: {
  current: Page;
  onNavigate: (p: Page) => void;
  open: boolean;
  onClose: () => void;
}) {
  const { profile, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const colors = ROLE_COLORS[profile?.role ?? 'Thành viên'];

  const navItems: { page: Page; label: string; icon: typeof Home }[] = [
    { page: 'home', label: 'Trang chủ', icon: Home },
    { page: 'chat', label: 'Chat', icon: MessageCircle },
    { page: 'members', label: 'Thành viên', icon: Users },
    { page: 'profile', label: 'Hồ sơ', icon: User },
  ];

  const isAdmin = profile && canManageUsers(profile.role);

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={onClose} />}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 anime-card z-50 flex flex-col transition-all duration-300 ${open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between px-5 h-16 border-b border-pink-200/50 dark:border-fuchsia-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl anime-btn-primary flex items-center justify-center anime-glow-pink">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold anime-text-gradient text-lg">Adino social</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-pink-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = current === item.page;
            return (
              <button key={item.page} onClick={() => { onNavigate(item.page); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  active
                    ? 'anime-btn-primary text-white'
                    : 'text-slate-500 dark:text-fuchsia-200/60 hover:text-pink-600 dark:hover:text-fuchsia-300 hover:bg-pink-100/50 dark:hover:bg-white/5'
                }`}>
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
          {isAdmin && (
            <>
              <div className="pt-3 pb-1 px-4">
                <span className="text-xs font-semibold text-slate-400 dark:text-fuchsia-300/40 uppercase tracking-wider">Quản trị</span>
              </div>
              <button onClick={() => { onNavigate('admin'); onClose(); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  current === 'admin'
                    ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white anime-glow-pink'
                    : 'text-slate-500 dark:text-fuchsia-200/60 hover:text-rose-500 hover:bg-rose-100/50 dark:hover:bg-white/5'
                }`}>
                <Shield className="w-5 h-5" />
                <span className="font-medium">Quản trị</span>
              </button>
            </>
          )}
        </nav>

        <div className="p-3 border-t border-pink-200/50 dark:border-fuchsia-500/20 space-y-2">
          <button onClick={toggle}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-slate-500 dark:text-fuchsia-200/60 hover:bg-pink-100/50 dark:hover:bg-white/5 transition-colors text-sm">
            <span className="flex items-center gap-2 font-medium">
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
            </span>
            <div className={`relative w-10 rounded-full transition-colors ${theme === 'dark' ? 'bg-fuchsia-500' : 'bg-pink-300'}`} style={{ height: 22 }}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform duration-300 ${theme === 'dark' ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
          </button>

          <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-pink-100/40 dark:bg-white/5">
            <Avatar profile={profile} size={40} showBadge />
            <div className="min-w-0 flex-1">
              <p className="text-slate-800 dark:text-white font-medium text-sm truncate">{profile?.username}</p>
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{profile?.role}</span>
            </div>
            <button onClick={signOut} className="text-slate-400 hover:text-rose-400 transition-colors p-2" title="Đăng xuất">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
