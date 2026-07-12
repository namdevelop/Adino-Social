import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  ROLE_COLORS, ROLE_RANK, ALL_ROLES, canManageUsers,
  canMuteUsers, isUserMuted, muteRemainingMinutes, MUTE_DURATION_MS,
} from '../lib/roles';
import type { Profile, Post } from '../lib/types';
import Avatar from '../components/Avatar';
import { Shield, Users, FileText, MessageSquare, Heart, Trash2, Search, Loader2, AlertCircle, BarChart3, VolumeX, Volume2 } from 'lucide-react';

type Tab = 'dashboard' | 'users' | 'posts';

export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [members, setMembers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<(Post & { like_count: number; comment_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0, likes: 0 });
  const [mutingId, setMutingId] = useState<string | null>(null);

  const canAccess = profile && canManageUsers(profile.role);
  const canMute = profile && canMuteUsers(profile.role);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [mRes, pRes, cRes, lRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('comments').select('*', { count: 'exact', head: true }),
      supabase.from('likes').select('*', { count: 'exact', head: true }),
    ]);
    setMembers((mRes.data as Profile[]) ?? []);
    const postsData = (pRes.data as Post[]) ?? [];
    setPosts(postsData.map((p) => ({ ...p, like_count: 0, comment_count: 0 })));
    setStats({ users: mRes.data?.length ?? 0, posts: postsData.length, comments: cRes.count ?? 0, likes: lRes.count ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Cập nhật lại giao diện mỗi 30s để đồng hồ đếm ngược "còn X phút" luôn đúng
  // và tự động ẩn trạng thái mute khi hết hạn (không cần thao tác gì thêm).
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (!canAccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-2">Không có quyền truy cập</h2>
        <p className="text-slate-400">Trang quản trị chỉ dành cho Admin và Phó Admin.</p>
      </div>
    );
  }

  const updateRole = async (userId: string, newRole: string) => {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
    setMembers(members.map((m) => (m.id === userId ? { ...m, role: newRole } : m)));
  };

  const muteUser = async (userId: string) => {
    if (!canMute) return;
    setMutingId(userId);
    const mutedUntil = new Date(Date.now() + MUTE_DURATION_MS).toISOString();
    const { error } = await supabase.from('profiles').update({ muted_until: mutedUntil }).eq('id', userId);
    if (!error) {
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, muted_until: mutedUntil } : m)));
    }
    setMutingId(null);
  };

  const unmuteUser = async (userId: string) => {
    if (!canMute) return;
    setMutingId(userId);
    const { error } = await supabase.from('profiles').update({ muted_until: null }).eq('id', userId);
    if (!error) {
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, muted_until: null } : m)));
    }
    setMutingId(null);
  };

  const deletePost = async (id: string) => {
    await supabase.from('posts').delete().eq('id', id);
    setPosts(posts.filter((p) => p.id !== id));
    setStats((s) => ({ ...s, posts: s.posts - 1 }));
  };

  const filteredMembers = members.filter((m) => m.username.toLowerCase().includes(search.toLowerCase()));
  const sortedMembers = [...filteredMembers].sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: BarChart3 },
    { id: 'users', label: 'Thành viên', icon: Users },
    { id: 'posts', label: 'Kiểm duyệt', icon: FileText },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center anime-glow-pink">
          <Shield className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold anime-text-gradient">Bảng quản trị</h1>
          <p className="text-slate-400 text-sm">Quản lý cộng đồng Anime social</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'anime-btn-primary text-white' : 'anime-card text-slate-500 dark:text-fuchsia-200/60 hover:text-pink-500'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : tab === 'dashboard' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Users} label="Thành viên" value={stats.users} />
            <StatCard icon={FileText} label="Bài đăng" value={stats.posts} />
            <StatCard icon={MessageSquare} label="Bình luận" value={stats.comments} />
            <StatCard icon={Heart} label="Lượt thích" value={stats.likes} />
          </div>
          <div className="anime-card rounded-2xl p-5">
            <h3 className="font-bold anime-text-gradient mb-4">Phân bố cấp bậc</h3>
            <div className="space-y-3">
              {ALL_ROLES.map((role) => {
                const count = members.filter((m) => m.role === role).length;
                const pct = stats.users > 0 ? (count / stats.users) * 100 : 0;
                const colors = ROLE_COLORS[role];
                return (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${colors.text}`}>{role}</span>
                      <span className="text-sm text-slate-400">{count}</span>
                    </div>
                    <div className="h-2 bg-pink-100 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${colors.dot}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : tab === 'users' ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm thành viên..."
              className="w-full pl-12 pr-4 py-3 rounded-xl anime-card text-slate-800 dark:text-white placeholder-slate-400 focus:border-pink-500 outline-none transition-all" />
          </div>
          <div className="anime-card rounded-2xl overflow-hidden overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-pink-200/50 dark:border-fuchsia-500/20 text-left text-xs text-slate-400 uppercase tracking-wider">
                  <th className="px-5 py-3 font-semibold">Thành viên</th>
                  <th className="px-5 py-3 font-semibold">Cấp bậc</th>
                  <th className="px-5 py-3 font-semibold">Ngày tham gia</th>
                  <th className="px-5 py-3 font-semibold text-right">Cấm chat</th>
                  <th className="px-5 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((m) => {
                  const colors = ROLE_COLORS[m.role];
                  const isSelf = m.id === profile?.id;
                  const muted = isUserMuted(m.muted_until);
                  const busy = mutingId === m.id;
                  return (
                    <tr key={m.id} className="border-b border-pink-100/50 dark:border-fuchsia-500/10 last:border-0 hover:bg-pink-50/50 dark:hover:bg-white/5">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar profile={m} size={36} showBadge />
                          <div>
                            <p className="text-sm font-medium text-slate-800 dark:text-white flex items-center gap-1.5">
                              {m.username}{isSelf && <span className="text-xs text-pink-500">(Bạn)</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><span className={`text-xs px-2.5 py-1 rounded-full ${colors.badge}`}>{m.role}</span></td>
                      <td className="px-5 py-3 text-sm text-slate-400">{new Date(m.created_at).toLocaleDateString('vi-VN')}</td>
                      <td className="px-5 py-3 text-right">
                        {muted ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-rose-500 dark:text-rose-400 flex items-center gap-1 whitespace-nowrap">
                              <VolumeX className="w-3.5 h-3.5" /> Còn {muteRemainingMinutes(m.muted_until)} phút
                            </span>
                            {canMute && !isSelf && (
                              <button onClick={() => unmuteUser(m.id)} disabled={busy}
                                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 hover:opacity-80 transition-opacity disabled:opacity-40 whitespace-nowrap">
                                {busy ? '...' : 'Bỏ cấm'}
                              </button>
                            )}
                          </div>
                        ) : canMute && !isSelf ? (
                          <button onClick={() => muteUser(m.id)} disabled={busy}
                            className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 hover:opacity-80 transition-opacity disabled:opacity-40 whitespace-nowrap">
                            <VolumeX className="w-3.5 h-3.5" /> {busy ? 'Đang xử lý...' : 'Cấm chat 60p'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600 flex items-center justify-end gap-1">
                            <Volume2 className="w-3.5 h-3.5" /> —
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <select value={m.role} disabled={isSelf} onChange={(e) => updateRole(m.id, e.target.value)}
                          className="bg-pink-50 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white text-sm rounded-lg px-3 py-1.5 outline-none focus:border-pink-500 disabled:opacity-40 cursor-pointer">
                          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.length === 0 ? (
            <div className="anime-card rounded-2xl p-12 text-center">
              <FileText className="w-12 h-12 text-pink-300 mx-auto mb-4" />
              <p className="text-slate-400">Chưa có bài đăng nào</p>
            </div>
          ) : posts.map((p) => (
            <div key={p.id} className="anime-card rounded-2xl p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-slate-700 dark:text-fuchsia-100/80 text-sm whitespace-pre-wrap">{p.content}</p>
                {p.image_url && <img src={p.image_url} alt="" className="mt-2 w-full max-h-48 object-cover rounded-xl" />}
                <p className="text-xs text-slate-400 mt-2">{new Date(p.created_at).toLocaleString('vi-VN')}</p>
              </div>
              <button onClick={() => deletePost(p.id)} className="text-slate-400 hover:text-rose-400 transition-colors p-2 shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <div className="anime-card rounded-2xl p-5">
      <Icon className="w-6 h-6 text-pink-500 mb-3" />
      <p className="text-3xl font-bold text-slate-800 dark:text-white">{value}</p>
      <p className="text-sm text-slate-400 mt-1">{label}</p>
    </div>
  );
}
