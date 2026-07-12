import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useTheme } from '../lib/theme';
import AnimeBackground from './AnimeBackground';
import { Loader2, Mail, Lock, User, Eye, EyeOff, Sparkles, Users, MessageCircle, Heart, Sun, Moon, ShieldOff } from 'lucide-react';

export default function AuthPage() {
  const { refreshProfile, banNotice, clearBanNotice } = useAuth();
  const { theme, toggle } = useTheme();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    clearBanNotice();

    if (mode === 'signup') {
      if (username.length < 6) return setError('Tên tài khoản phải trên 6 ký tự');
      if (password.length < 6) return setError('Mật khẩu phải trên 6 ký tự');
      if (password !== confirmPassword) return setError('Mật khẩu không khớp');
    }

    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password, options: { data: { username } },
        });
        if (error) throw error;
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id, username, role: 'Thành viên',
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      await refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đã xảy ra lỗi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-pink-50 dark:bg-[#0a0118] transition-colors duration-500 relative overflow-hidden">
      <AnimeBackground />

      <button
        onClick={toggle}
        className="fixed top-5 right-5 z-50 w-11 h-11 rounded-xl anime-card flex items-center justify-center text-pink-600 dark:text-fuchsia-300 hover:scale-110 transition-all"
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      <div className="hidden lg:flex lg:w-1/2 relative z-10 items-center justify-center px-16">
        <div className="relative z-10 text-white max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl anime-btn-primary flex items-center justify-center anime-glow-pink">
              <Sparkles className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold anime-text-gradient">Anime social</span>
          </div>
          <h1 className="text-4xl font-bold leading-tight mb-4 text-white">
            Cộng đồng chia sẻ<br />
            <span className="anime-text-gradient">kiến thức & kết nối</span>
          </h1>
          <p className="text-pink-200/70 text-lg mb-10">
            Nơi gặp gỡ của những người yêu thích anime — đăng bài, bình luận, chat & tương tác.
          </p>
          <div className="space-y-4">
            {[
              { icon: Users, text: '5 cấp bậc với quyền hạn khác nhau' },
              { icon: MessageCircle, text: 'Chat realtime & thảo luận' },
              { icon: Heart, text: 'Yêu thích & chia sẻ bài viết' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3 text-pink-100">
                <div className="w-10 h-10 rounded-xl anime-card flex items-center justify-center">
                  <f.icon className="w-5 h-5 text-pink-400" />
                </div>
                <span>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-md anime-card rounded-3xl p-8">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl anime-btn-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold anime-text-gradient">Anime social</span>
          </div>

          <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
            {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
          </h2>
          <p className="text-slate-500 dark:text-fuchsia-200/60 mb-8">
            {mode === 'login' ? 'Chào mừng bạn quay lại!' : 'Tham gia cộng đồng ngay hôm nay'}
          </p>

          {banNotice && (
            <div className="mb-6 rounded-xl bg-rose-100 dark:bg-rose-500/15 border border-rose-300 dark:border-rose-500/40 px-4 py-3.5 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <ShieldOff className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{banNotice}</span>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-3 text-rose-600 dark:text-rose-400 text-sm animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <InputField icon={<User className="w-5 h-5" />} type="text" placeholder="Tên tài khoản" value={username} onChange={setUsername} />
            )}
            <InputField icon={<Mail className="w-5 h-5" />} type="email" placeholder="Địa chỉ email" value={email} onChange={setEmail} />
            <div className="relative">
              <InputField icon={<Lock className="w-5 h-5" />} type={showPassword ? 'text' : 'password'} placeholder="Mật khẩu" value={password} onChange={setPassword} />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-pink-500 transition-colors">
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {mode === 'signup' && (
              <InputField icon={<Lock className="w-5 h-5" />} type={showPassword ? 'text' : 'password'} placeholder="Nhập lại mật khẩu" value={confirmPassword} onChange={setConfirmPassword} />
            )}

            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl anime-btn-primary font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}
            </button>
          </form>

          <p className="text-center text-slate-500 dark:text-fuchsia-200/60 mt-8">
            {mode === 'login' ? 'Bạn chưa có tài khoản? ' : 'Bạn đã có tài khoản? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); clearBanNotice(); }} className="text-pink-500 dark:text-fuchsia-400 hover:text-pink-600 dark:hover:text-fuchsia-300 font-semibold transition-colors">
              {mode === 'login' ? 'Đăng ký ngay' : 'Đăng nhập'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function InputField({ icon, type, placeholder, value, onChange }: { icon: React.ReactNode; type: string; placeholder: string; value: string; onChange: (v: string) => void; }) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-400">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        className="w-full pl-12 pr-4 py-3.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-fuchsia-200/40 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20 outline-none transition-all"
      />
    </div>
  );
}
