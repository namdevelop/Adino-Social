import { useState } from 'react';
import AnimeBackground from './AnimeBackground';
import AuthPage from './AuthPage';
import { Wrench, ShieldQuestion, LogOut } from 'lucide-react';

export default function MaintenancePage({
  message,
  mode,
  onLogout,
}: {
  message?: string | null;
  mode: 'guest' | 'blocked-user';
  onLogout?: () => void;
}) {
  const [showLogin, setShowLogin] = useState(false);

  // Người chưa đăng nhập có thể bấm để mở form đăng nhập bình thường
  // (dành cho quản trị viên cần vào để tắt bảo trì)
  if (mode === 'guest' && showLogin) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-pink-50 dark:bg-[#0a0118] relative overflow-hidden px-6">
      <AnimeBackground />
      <div className="relative z-10 max-w-md w-full anime-card rounded-3xl p-8 text-center animate-in fade-in">
        <div className="w-16 h-16 rounded-2xl anime-btn-primary flex items-center justify-center mx-auto mb-5 anime-glow-pink">
          <Wrench className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold anime-text-gradient mb-2">Hệ thống đang bảo trì</h1>
        <p className="text-slate-500 dark:text-fuchsia-200/60 text-sm mb-6 whitespace-pre-wrap">
          {message || 'Chúng mình đang nâng cấp để mang lại trải nghiệm tốt hơn. Vui lòng quay lại sau ít phút nhé!'}
        </p>

        {mode === 'guest' ? (
          <button
            onClick={() => setShowLogin(true)}
            className="text-xs text-slate-400 hover:text-pink-500 flex items-center justify-center gap-1.5 mx-auto transition-colors"
          >
            <ShieldQuestion className="w-3.5 h-3.5" /> Đăng nhập quản trị viên
          </button>
        ) : (
          onLogout && (
            <button
              onClick={onLogout}
              className="text-xs text-slate-400 hover:text-rose-500 flex items-center justify-center gap-1.5 mx-auto transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Đăng xuất
            </button>
          )
        )}
      </div>
    </div>
  );
}
