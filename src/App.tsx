import { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { ThemeProvider, useTheme } from './lib/theme';
import { canManageUsers } from './lib/roles';
import AuthPage from './components/AuthPage';
import MaintenancePage from './components/MaintenancePage';
import AnimeBackground from './components/AnimeBackground';
import Sidebar from './components/Sidebar';
import MusicWidget from './components/MusicWidget';
import NotificationBell from './components/NotificationBell';
import { Loader2, Menu, Sun, Moon, Wrench } from 'lucide-react';

// Lazy-load từng trang: chỉ tải code của trang đang mở, không tải hết
// 8 trang cùng lúc lúc mới vào app -> giảm đáng kể thời gian tải ban đầu.
const HomePage = lazy(() => import('./pages/HomePage'));
const MembersPage = lazy(() => import('./pages/MembersPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const TopUpPage = lazy(() => import('./pages/TopUpPage'));
const ShopPage = lazy(() => import('./pages/ShopPage'));
const TasksPage = lazy(() => import('./pages/TasksPage'));

export type Page = 'home' | 'chat' | 'members' | 'profile' | 'admin' | 'topup' | 'shop' | 'tasks';

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
    </div>
  );
}

function AppContent() {
  const { session, profile, loading, banNotice, maintenance, maintenanceLoading, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const [page, setPage] = useState<Page>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading || maintenanceLoading) {
    return (
      <div className="min-h-screen bg-pink-50 dark:bg-[#0a0118] flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-pink-500" />
      </div>
    );
  }

  const maintenanceOn = !!maintenance?.maintenance_mode;

  if (!session) {
    // Chưa đăng nhập: nếu đang bảo trì thì hiện màn hình bảo trì (có link để
    // quản trị viên vẫn đăng nhập được), ngược lại hiện trang đăng nhập bình thường.
    if (maintenanceOn) return <MaintenancePage mode="guest" message={maintenance?.maintenance_message} />;
    return <AuthPage />;
  }

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

  const isAdminTier = canManageUsers(profile.role);

  // Đã đăng nhập nhưng không phải cấp quản trị + đang bảo trì -> chặn dùng app
  if (maintenanceOn && !isAdminTier) {
    return <MaintenancePage mode="blocked-user" message={maintenance?.maintenance_message} onLogout={signOut} />;
  }

  return (
    <div className="min-h-screen bg-pink-50 dark:bg-[#0a0118] flex transition-colors duration-500 relative">
      <AnimeBackground />
      <Sidebar current={page} onNavigate={setPage} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 min-w-0 relative z-10">
        {maintenanceOn && isAdminTier && (
          <div className="sticky top-0 z-40 bg-amber-500 text-white text-xs sm:text-sm font-medium px-4 py-2 flex items-center justify-center gap-2 text-center">
            <Wrench className="w-3.5 h-3.5 shrink-0" />
            Chế độ bảo trì đang BẬT — chỉ quản trị viên thấy được app. Vào Bảng quản trị → Bảo trì để tắt.
          </div>
        )}
        <header className="lg:hidden sticky top-0 z-30 anime-card px-4 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-600 dark:text-fuchsia-200">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-bold anime-text-gradient">Adino Social</span>
          <button onClick={toggle} className="p-2 rounded-lg text-slate-600 dark:text-fuchsia-200 hover:bg-pink-100 dark:hover:bg-white/5 transition-colors">
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </header>

        <main>
          <Suspense fallback={<PageLoading />}>
            {page === 'home' && <HomePage />}
            {page === 'chat' && <ChatPage />}
            {page === 'members' && <MembersPage />}
            {page === 'profile' && <ProfilePage />}
            {page === 'topup' && <TopUpPage />}
            {page === 'shop' && <ShopPage />}
            {page === 'tasks' && <TasksPage />}
            {page === 'admin' && <AdminPage />}
          </Suspense>
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
