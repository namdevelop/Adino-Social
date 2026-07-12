import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import {
  ROLE_COLORS, ROLE_RANK, ALL_ROLES, canManageUsers,
  canMuteUsers, isUserMuted, muteRemainingMinutes, MUTE_DURATION_MS, canBanUsers,
} from '../lib/roles';
import type { Profile, Post, Announcement } from '../lib/types';
import { listAnnouncements, createAnnouncement, deleteAnnouncement } from '../lib/announcements';
import Avatar from '../components/Avatar';
import { Shield, Users, FileText, MessageSquare, Heart, Trash2, Search, Loader2, AlertCircle, BarChart3, VolumeX, Volume2, MessagesSquare, Megaphone, ShieldOff, ShieldCheck } from 'lucide-react';

type Tab = 'dashboard' | 'users' | 'posts' | 'chat' | 'announcements';

export default function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [members, setMembers] = useState<Profile[]>([]);
  const [posts, setPosts] = useState<(Post & { like_count: number; comment_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ users: 0, posts: 0, comments: 0, likes: 0, messages: 0 });
  const [mutingId, setMutingId] = useState<string | null>(null);
  const [banningId, setBanningId] = useState<string | null>(null);
  const [usersActionMsg, setUsersActionMsg] = useState('');
  const [deleteBefore, setDeleteBefore] = useState('');
  const [deletingMessages, setDeletingMessages] = useState<'all' | 'before' | null>(null);
  const [chatActionMsg, setChatActionMsg] = useState('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [posting, setPosting] = useState(false);
  const [annError, setAnnError] = useState('');
  const [deletingAnnId, setDeletingAnnId] = useState<string | null>(null);

  const canAccess = profile && canManageUsers(profile.role);
  const canMute = profile && canMuteUsers(profile.role);
  const canBan = profile && canBanUsers(profile.role);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [mRes, pRes, cRes, lRes, chatRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
      supabase.from('comments').select('*', { count: 'exact', head: true }),
      supabase.from('likes').select('*', { count: 'exact', head: true }),
      supabase.from('chat_messages').select('*', { count: 'exact', head: true }),
    ]);
    setMembers((mRes.data as Profile[]) ?? []);
    const postsData = (pRes.data as Post[]) ?? [];
    setPosts(postsData.map((p) => ({ ...p, like_count: 0, comment_count: 0 })));
    setStats({ users: mRes.data?.length ?? 0, posts: postsData.length, comments: cRes.count ?? 0, likes: lRes.count ?? 0, messages: chatRes.count ?? 0 });
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    listAnnouncements().then(setAnnouncements).catch(() => {});
  }, []);

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
    const prevMembers = members;
    setMembers(members.map((m) => (m.id === userId ? { ...m, role: newRole } : m)));
    setUsersActionMsg('');
    const { data, error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId).select('id');
    if (error || !data || data.length === 0) {
      setMembers(prevMembers); // hoàn tác giao diện vì update thực tế thất bại
      setUsersActionMsg(
        error
          ? `Không thể đổi cấp bậc: ${error.message}`
          : 'Không thể đổi cấp bậc: bạn chưa có quyền cập nhật hồ sơ người khác. Hãy chạy file SQL "2026_fix_profiles_admin_update.sql".'
      );
    }
  };

  const muteUser = async (userId: string) => {
    if (!canMute) return;
    setMutingId(userId);
    setUsersActionMsg('');
    const mutedUntil = new Date(Date.now() + MUTE_DURATION_MS).toISOString();
    const { data, error } = await supabase.from('profiles').update({ muted_until: mutedUntil }).eq('id', userId).select('id');
    if (!error && data && data.length > 0) {
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, muted_until: mutedUntil } : m)));
    } else {
      setUsersActionMsg(
        error
          ? `Không thể cấm chat: ${error.message}`
          : 'Không thể cấm chat: bạn chưa có quyền cập nhật hồ sơ người khác. Hãy chạy file SQL "2026_fix_profiles_admin_update.sql".'
      );
    }
    setMutingId(null);
  };

  const unmuteUser = async (userId: string) => {
    if (!canMute) return;
    setMutingId(userId);
    setUsersActionMsg('');
    const { data, error } = await supabase.from('profiles').update({ muted_until: null }).eq('id', userId).select('id');
    if (!error && data && data.length > 0) {
      setMembers((prev) => prev.map((m) => (m.id === userId ? { ...m, muted_until: null } : m)));
    } else {
      setUsersActionMsg(
        error
          ? `Không thể bỏ cấm: ${error.message}`
          : 'Không thể bỏ cấm: bạn chưa có quyền cập nhật hồ sơ người khác. Hãy chạy file SQL "2026_fix_profiles_admin_update.sql".'
      );
    }
    setMutingId(null);
  };

  const banUser = async (member: Profile) => {
    if (!canBan || !profile) return;
    if (member.id === profile.id) return;
    if (ROLE_RANK[member.role] >= ROLE_RANK[profile.role]) {
      setUsersActionMsg('Bạn không thể cấm người có cấp bậc bằng hoặc cao hơn mình.');
      return;
    }
    if (!confirm(`Bạn có chắc chắn muốn CẤM VĨNH VIỄN tài khoản "${member.username}"? Họ sẽ bị đăng xuất ngay lập tức và không thể đăng nhập lại.`)) return;
    setBanningId(member.id);
    setUsersActionMsg('');
    const { data, error } = await supabase.from('profiles').update({ is_banned: true }).eq('id', member.id).select('id');
    if (!error && data && data.length > 0) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, is_banned: true } : m)));
    } else {
      setUsersActionMsg(
        error
          ? `Không thể cấm tài khoản: ${error.message}`
          : 'Không thể cấm tài khoản: bạn chưa có quyền cập nhật hồ sơ người khác. Hãy chạy file SQL "2026_fix_profiles_admin_update.sql" và "2026_add_permanent_ban.sql".'
      );
    }
    setBanningId(null);
  };

  const unbanUser = async (member: Profile) => {
    if (!canBan) return;
    setBanningId(member.id);
    setUsersActionMsg('');
    const { data, error } = await supabase.from('profiles').update({ is_banned: false }).eq('id', member.id).select('id');
    if (!error && data && data.length > 0) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? { ...m, is_banned: false } : m)));
    } else {
      setUsersActionMsg(
        error
          ? `Không thể bỏ cấm: ${error.message}`
          : 'Không thể bỏ cấm: bạn chưa có quyền cập nhật hồ sơ người khác.'
      );
    }
    setBanningId(null);
  };

  const deletePost = async (id: string) => {
    await supabase.from('posts').delete().eq('id', id);
    setPosts(posts.filter((p) => p.id !== id));
    setStats((s) => ({ ...s, posts: s.posts - 1 }));
  };

  const postAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim() || !profile || posting) return;
    setPosting(true);
    setAnnError('');
    try {
      const a = await createAnnouncement(annTitle, annContent, profile.id);
      setAnnouncements((prev) => (prev.some((p) => p.id === a.id) ? prev : [a, ...prev]));
      setAnnTitle('');
      setAnnContent('');
    } catch (err: any) {
      const msg = err?.message || err?.error_description || err?.hint || err?.details;
      setAnnError(msg ? String(msg) : `Không thể đăng thông báo (lỗi không xác định: ${JSON.stringify(err)})`);
      // In lỗi gốc ra console để dễ debug khi cần
      console.error('postAnnouncement error:', err);
    } finally {
      setPosting(false);
    }
  };

  const removeAnnouncement = async (id: string) => {
    setDeletingAnnId(id);
    try {
      await deleteAnnouncement(id);
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // bỏ qua lỗi nhỏ, danh sách sẽ tự khớp lại qua realtime
    } finally {
      setDeletingAnnId(null);
    }
  };

  const deleteAllMessages = async () => {
    if (!canMute || deletingMessages) return;
    if (!confirm('Bạn có chắc chắn muốn xoá TOÀN BỘ tin nhắn chat (phòng chung + tin nhắn riêng)? Hành động này không thể hoàn tác.')) return;
    setDeletingMessages('all');
    setChatActionMsg('');
    const { error } = await supabase.from('chat_messages').delete().gte('created_at', '1970-01-01T00:00:00.000Z');
    if (error) {
      setChatActionMsg(`Lỗi: ${error.message}`);
    } else {
      setStats((s) => ({ ...s, messages: 0 }));
      setChatActionMsg('Đã xoá toàn bộ tin nhắn.');
    }
    setDeletingMessages(null);
  };

  const deleteMessagesBefore = async () => {
    if (!canMute || !deleteBefore || deletingMessages) return;
    const cutoff = new Date(deleteBefore);
    if (isNaN(cutoff.getTime())) return;
    if (!confirm(`Xoá tất cả tin nhắn được gửi trước ${cutoff.toLocaleString('vi-VN')}?`)) return;
    setDeletingMessages('before');
    setChatActionMsg('');
    const { error, count } = await supabase
      .from('chat_messages')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff.toISOString());
    if (error) {
      setChatActionMsg(`Lỗi: ${error.message}`);
    } else {
      setStats((s) => ({ ...s, messages: Math.max(0, s.messages - (count ?? 0)) }));
      setChatActionMsg(`Đã xoá ${count ?? 0} tin nhắn trước mốc thời gian đã chọn.`);
    }
    setDeletingMessages(null);
  };

  const filteredMembers = members.filter((m) => m.username.toLowerCase().includes(search.toLowerCase()));
  const sortedMembers = [...filteredMembers].sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);

  const tabs: { id: Tab; label: string; icon: typeof Shield }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: BarChart3 },
    { id: 'users', label: 'Thành viên', icon: Users },
    { id: 'posts', label: 'Kiểm duyệt', icon: FileText },
    { id: 'chat', label: 'Tin nhắn', icon: MessagesSquare },
    { id: 'announcements', label: 'Thông báo', icon: Megaphone },
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
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard icon={Users} label="Thành viên" value={stats.users} />
            <StatCard icon={FileText} label="Bài đăng" value={stats.posts} />
            <StatCard icon={MessageSquare} label="Bình luận" value={stats.comments} />
            <StatCard icon={Heart} label="Lượt thích" value={stats.likes} />
            <StatCard icon={MessagesSquare} label="Tin nhắn chat" value={stats.messages} />
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
          {usersActionMsg && (
            <div className="rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /> {usersActionMsg}
              <button onClick={() => setUsersActionMsg('')} className="ml-auto text-rose-400 hover:text-rose-600">×</button>
            </div>
          )}
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
                  <th className="px-5 py-3 font-semibold text-right">Tài khoản</th>
                  <th className="px-5 py-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {sortedMembers.map((m) => {
                  const colors = ROLE_COLORS[m.role];
                  const isSelf = m.id === profile?.id;
                  const muted = isUserMuted(m.muted_until);
                  const busy = mutingId === m.id;
                  const banBusy = banningId === m.id;
                  const canBanThis = canBan && !isSelf && ROLE_RANK[m.role] < ROLE_RANK[profile?.role ?? ''];
                  return (
                    <tr key={m.id} className={`border-b border-pink-100/50 dark:border-fuchsia-500/10 last:border-0 hover:bg-pink-50/50 dark:hover:bg-white/5 ${m.is_banned ? 'opacity-50' : ''}`}>
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
                        {m.is_banned ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1 whitespace-nowrap">
                              <ShieldOff className="w-3.5 h-3.5" /> Đã bị cấm
                            </span>
                            {canBan && !isSelf && (
                              <button onClick={() => unbanUser(m)} disabled={banBusy}
                                className="text-xs px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 hover:opacity-80 transition-opacity disabled:opacity-40 whitespace-nowrap">
                                {banBusy ? '...' : 'Bỏ cấm'}
                              </button>
                            )}
                          </div>
                        ) : canBanThis ? (
                          <button onClick={() => banUser(m)} disabled={banBusy}
                            className="ml-auto flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors disabled:opacity-40 whitespace-nowrap font-medium">
                            <ShieldOff className="w-3.5 h-3.5" /> {banBusy ? 'Đang xử lý...' : 'Cấm vĩnh viễn'}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-300 dark:text-slate-600 flex items-center justify-end gap-1">
                            <ShieldCheck className="w-3.5 h-3.5" /> —
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
      ) : tab === 'posts' ? (
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
      ) : tab === 'chat' ? (
        <div className="space-y-4">
          <div className="anime-card rounded-2xl p-5">
            <h3 className="font-bold anime-text-gradient mb-1">Quản lý tin nhắn chat</h3>
            <p className="text-sm text-slate-400 mb-5">
              Hiện có <span className="font-semibold text-slate-600 dark:text-fuchsia-200">{stats.messages}</span> tin nhắn trong hệ thống (bao gồm phòng chung và tin nhắn riêng).
            </p>

            {chatActionMsg && (
              <div className="mb-4 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 px-4 py-2.5 text-cyan-700 dark:text-cyan-300 text-sm flex items-center gap-2">
                {chatActionMsg}
                <button onClick={() => setChatActionMsg('')} className="ml-auto text-cyan-400 hover:text-cyan-600">×</button>
              </div>
            )}

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20">
                <div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-white">Xoá toàn bộ tin nhắn</p>
                  <p className="text-xs text-slate-400 mt-0.5">Xoá vĩnh viễn tất cả tin nhắn trong hệ thống — không thể hoàn tác.</p>
                </div>
                <button onClick={deleteAllMessages} disabled={!canMute || deletingMessages !== null}
                  className="shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
                  {deletingMessages === 'all' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Xoá tất cả
                </button>
              </div>

              <div className="p-4 rounded-xl bg-pink-50/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/15">
                <p className="text-sm font-semibold text-slate-700 dark:text-white">Xoá tin nhắn trước một mốc thời gian</p>
                <p className="text-xs text-slate-400 mt-0.5 mb-3">Xoá vĩnh viễn tất cả tin nhắn được gửi trước thời điểm bạn chọn bên dưới.</p>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="datetime-local"
                    value={deleteBefore}
                    onChange={(e) => setDeleteBefore(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-white/70 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-sm text-slate-800 dark:text-white outline-none focus:border-pink-500 transition-all"
                  />
                  <button onClick={deleteMessagesBefore} disabled={!canMute || !deleteBefore || deletingMessages !== null}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50">
                    {deletingMessages === 'before' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Xoá tin nhắn cũ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="anime-card rounded-2xl p-5">
            <h3 className="font-bold anime-text-gradient mb-1">Đăng thông báo</h3>
            <p className="text-sm text-slate-400 mb-4">Thông báo sẽ hiện ngay lập tức cho tất cả thành viên qua biểu tượng chuông ở góc phải màn hình.</p>

            {annError && (
              <div className="mb-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm">
                {annError}
              </div>
            )}

            <div className="space-y-3">
              <input value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} placeholder="Tiêu đề thông báo"
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 transition-all" />
              <textarea value={annContent} onChange={(e) => setAnnContent(e.target.value)} rows={3} placeholder="Nội dung thông báo..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 resize-none transition-all" />
              <button onClick={postAnnouncement} disabled={!annTitle.trim() || !annContent.trim() || posting}
                className="px-5 py-2.5 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                Đăng thông báo
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {announcements.length === 0 ? (
              <div className="anime-card rounded-2xl p-12 text-center">
                <Megaphone className="w-12 h-12 text-pink-300 mx-auto mb-4" />
                <p className="text-slate-400">Chưa có thông báo nào</p>
              </div>
            ) : announcements.map((a) => (
              <div key={a.id} className="anime-card rounded-2xl p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white">{a.title}</p>
                  <p className="text-sm text-slate-600 dark:text-fuchsia-100/70 mt-1 whitespace-pre-wrap">{a.content}</p>
                  <p className="text-xs text-slate-400 mt-2">{new Date(a.created_at).toLocaleString('vi-VN')}</p>
                </div>
                <button onClick={() => removeAnnouncement(a.id)} disabled={deletingAnnId === a.id}
                  className="text-slate-400 hover:text-rose-400 transition-colors p-2 shrink-0 disabled:opacity-40">
                  {deletingAnnId === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </button>
              </div>
            ))}
          </div>
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
