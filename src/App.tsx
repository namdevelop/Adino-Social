import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider, useTheme } from './lib/theme';
import AuthPage from './components/AuthPage';
import AnimeBackground from './components/AnimeBackground';
import Sidebar from './components/Sidebar';
import MusicWidget from './components/MusicWidget';
import NotificationBell from './components/NotificationBell';
import HomePage from './pages/HomePage';
import MembersPage from './pages/MembersPage';
import ProfilePage from './pages/ProfilePage';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import { Loader2, Menu, Sun, Moon } from 'lucide-react';

export type Page = 'home' | 'chat' | 'members' | 'profile' | 'admin';

function AppContent() {
  const { session, profile, loading, banNotice } = useAuth();
  const { theme, toggle } = useTheme();
  const [page, setPage] = useState<Page>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-pink-50 dark:bg-[#0a0118] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }

  if (!session) return <AuthPage />;

  // Trong lúc tài khoản đang bị đăng xuất cưỡng bức vì bị cấm vĩnh viễn
  // (session vẫn còn tồn tại trong khoảnh khắc ngắn), tránh render giao
  // diện chính với profile rỗng — hiện màn hình chờ thay vì nội dung app.
  if (!profile && !banNotice) {
    return (
      <div className="min-h-screen bg-pink-50 dark:bg-[#0a0118] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }
  if (!profile) return <AuthPage />;

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-[#0a0118] flex transition-colors duration-500 relative">
      <AnimeBackground />
      <Sidebar current={page} onNavigate={setPage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 relative z-10">
        <header className="lg:hidden sticky top-0 z-30 anime-card px-4 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600 dark:text-fuchsia-200">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold anime-text-gradient">Anime Social</span>
          <button onClick={toggle} className="p-2 rounded-lg text-slate-600 dark:text-fuchsia-200 hover:bg-pink-100 dark:hover:bg-white/5 transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        <main>
          {page === 'home' && <HomePage />}
          {page === 'chat' && <ChatPage />}
          {page === 'members' && <MembersPage />}
          {page === 'profile' && <ProfilePage />}
          {page === 'admin' && <AdminPage />}
        </main>
      </div>

      <MusicWidget />
      <NotificationBell />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
