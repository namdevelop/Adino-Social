import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_COLORS } from '../lib/roles';
import type { Post } from '../lib/types';
import Avatar from '../components/Avatar';
import { Loader2, Edit3, Save, X, Calendar, Heart, MessageSquare, HelpCircle, ImagePlus } from 'lucide-react';

export default function ProfilePage() {
  const { profile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [stats, setStats] = useState({ posts: 0, likes: 0, comments: 0 });
  const [showImgHelp, setShowImgHelp] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setAvatarUrl(profile.avatar_url ?? '');
    setBio(profile.bio ?? '');
    supabase.from('posts').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).then(({ data }) => {
      setPosts((data as Post[]) ?? []);
    });
    supabase.from('likes').select('*, posts!inner(user_id)').eq('posts.user_id', profile.id).then(({ data }) => {
      setStats((s) => ({ ...s, likes: data?.length ?? 0 }));
    });
    supabase.from('comments').select('*, posts!inner(user_id)').eq('posts.user_id', profile.id).then(({ data }) => {
      setStats((s) => ({ ...s, comments: data?.length ?? 0 }));
    });
  }, [profile]);

  useEffect(() => { setStats((s) => ({ ...s, posts: posts.length })); }, [posts]);

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase.from('profiles').update({
      username: username.trim(), avatar_url: avatarUrl.trim() || null, bio: bio.trim() || null,
    }).eq('id', profile.id);
    await refreshProfile();
    setEditing(false);
    setSaving(false);
  };

  if (!profile) return null;
  const colors = ROLE_COLORS[profile.role];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="anime-card rounded-3xl overflow-hidden mb-6">
        <div className="h-28 bg-gradient-to-r from-pink-400 via-fuchsia-500 to-cyan-400 anime-shimmer" />
        <div className="px-6 pb-6 -mt-12">
          <div className="flex items-end justify-between mb-4">
            <div className="ring-4 ring-white/80 dark:ring-slate-900/80 rounded-full">
              <Avatar profile={profile} size={88} showBadge />
            </div>
            {!editing ? (
              <button onClick={() => setEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl anime-card text-pink-500 hover:text-pink-600 text-sm font-medium transition-colors">
                <Edit3 className="w-4 h-4" /> Sửa hồ sơ
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => setEditing(false)} className="p-2 rounded-xl text-slate-400 hover:text-rose-400 transition-colors"><X className="w-4 h-4" /></button>
                <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Lưu
                </button>
              </div>
            )}
          </div>

          {!editing ? (
            <>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{profile.username}</h1>
              <span className={`inline-block text-sm px-3 py-1 rounded-full ${colors.badge} mt-2`}>{profile.role}</span>
              {profile.bio && <p className="text-slate-600 dark:text-fuchsia-100/70 mt-3 text-sm">{profile.bio}</p>}
              <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                <Calendar className="w-4 h-4" /> Tham gia {new Date(profile.created_at).toLocaleDateString('vi-VN')}
              </div>
            </>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-fuchsia-200/60 mb-1 block">Tên tài khoản</label>
                <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-white/50 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white outline-none focus:border-pink-500 transition-all" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-500 dark:text-fuchsia-200/60 block">URL ảnh đại diện</label>
                  <button type="button" onClick={() => setShowImgHelp((v) => !v)}
                    className="text-xs text-pink-500 hover:text-pink-600 flex items-center gap-1 font-medium transition-colors">
                    <HelpCircle className="w-3.5 h-3.5" /> Cách lấy link ảnh
                  </button>
                </div>
                <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." className="w-full px-4 py-2.5 rounded-xl bg-white/50 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 transition-all" />
                {showImgHelp && (
                  <div className="mt-2 p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 text-xs text-slate-600 dark:text-fuchsia-100/70 space-y-2 animate-in fade-in">
                    <p className="font-semibold text-cyan-700 dark:text-cyan-300 flex items-center gap-1.5">
                      <ImagePlus className="w-3.5 h-3.5" /> Cách đổi ảnh thành link (URL):
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5">
                      <li>Truy cập một trang tải ảnh miễn phí, ví dụ <span className="font-semibold">imgur.com</span> hoặc <span className="font-semibold">postimages.org</span>.</li>
                      <li>Bấm nút <span className="font-semibold">"Upload" / "Tải ảnh lên"</span> rồi chọn ảnh từ máy hoặc điện thoại của bạn.</li>
                      <li>Sau khi tải xong, tìm dòng link có tên <span className="font-semibold">"Direct link"</span> hoặc <span className="font-semibold">"Ảnh trực tiếp"</span> — link này thường kết thúc bằng đuôi <span className="font-semibold">.jpg, .png, .webp</span>...</li>
                      <li>Copy link đó rồi dán vào ô "URL ảnh đại diện" ở trên, sau đó bấm <span className="font-semibold">Lưu</span>.</li>
                    </ol>
                    <p className="text-[11px] text-slate-400 pt-1">Lưu ý: link ảnh phải là link ảnh trực tiếp (mở link ra chỉ thấy ảnh), không phải link trang web chứa ảnh.</p>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-fuchsia-200/60 mb-1 block">Tiểu sử</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Giới thiệu bản thân..." className="w-full px-4 py-2.5 rounded-xl bg-white/50 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 resize-none transition-all" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatBox icon={MessageSquare} label="Bài đăng" value={stats.posts} />
        <StatBox icon={Heart} label="Lượt thích" value={stats.likes} />
        <StatBox icon={MessageSquare} label="Bình luận" value={stats.comments} />
      </div>

      <h2 className="font-bold anime-text-gradient mb-3">Bài đăng của tôi</h2>
      {posts.length === 0 ? (
        <div className="anime-card rounded-2xl p-8 text-center text-slate-400">Chưa có bài đăng nào</div>
      ) : posts.map((p) => (
        <div key={p.id} className="anime-card rounded-2xl p-4 mb-3">
          <p className="text-slate-700 dark:text-fuchsia-100/80 text-sm whitespace-pre-wrap">{p.content}</p>
          {p.image_url && <img src={p.image_url} alt="" className="mt-2 w-full max-h-48 object-cover rounded-xl" />}
          <p className="text-xs text-slate-400 mt-2">{new Date(p.created_at).toLocaleString('vi-VN')}</p>
        </div>
      ))}
    </div>
  );
}

function StatBox({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value: number }) {
  return (
    <div className="anime-card rounded-2xl p-4 text-center">
      <Icon className="w-5 h-5 text-pink-500 mx-auto mb-2" />
      <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
    </div>
  );
}
