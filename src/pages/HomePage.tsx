import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_COLORS } from '../lib/roles';
import type { Profile, Post, Comment } from '../lib/types';
import Avatar from '../components/Avatar';
import { Loader2, Heart, MessageSquare, Send, Trash2, ImagePlus, X, Sparkles, Info, Lock } from 'lucide-react';

export default function HomePage() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [content, setContent] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [showImageInput, setShowImageInput] = useState(false);
  const [posting, setPosting] = useState(false);
  const [profileCache, setProfileCache] = useState<Record<string, Profile>>({});
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const isSlave = profile?.role === 'Nô lệ';

  const fetchProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter((id) => !profileCache[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from('profiles').select('*').in('id', missing);
    if (data) {
      setProfileCache((prev) => {
        const next = { ...prev };
        (data as Profile[]).forEach((p) => { next[p.id] = p; });
        return next;
      });
    }
  }, [profileCache]);

  const loadPosts = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(50);
    const postsData = (data as Post[]) ?? [];
    setPosts(postsData);

    if (postsData.length > 0) {
      const postIds = postsData.map((p) => p.id);
      const { data: likesData } = await supabase.from('likes').select('post_id, user_id').in('post_id', postIds);
      const { data: commentsData } = await supabase.from('comments').select('post_id').in('post_id', postIds);

      const likeMap: Record<string, number> = {};
      const likedByMe: Record<string, boolean> = {};
      (likesData as any[])?.forEach((l) => {
        likeMap[l.post_id] = (likeMap[l.post_id] ?? 0) + 1;
        if (l.user_id === profile?.id) likedByMe[l.post_id] = true;
      });
      const commentMap: Record<string, number> = {};
      (commentsData as any[])?.forEach((c) => {
        commentMap[c.post_id] = (commentMap[c.post_id] ?? 0) + 1;
      });

      setPosts(postsData.map((p) => ({
        ...p,
        like_count: likeMap[p.id] ?? 0,
        comment_count: commentMap[p.id] ?? 0,
        liked_by_me: likedByMe[p.id] ?? false,
      })));

      const authorIds = [...new Set(postsData.map((p) => p.user_id))];
      await fetchProfiles(authorIds);
    }
    setLoading(false);
  }, [profile?.id, fetchProfiles]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    const channel = supabase.channel('posts-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => loadPosts())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => loadPosts())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [loadPosts]);

  const submitPost = async () => {
    if (isSlave) return;
    if (!content.trim() || !profile || posting) return;
    setPosting(true);
    const { data } = await supabase.from('posts').insert({
      user_id: profile.id, content: content.trim(),
      image_url: imageUrl.trim() || null,
    }).select('*').single();
    if (data) {
      setPosts((prev) => [{ ...data as Post, like_count: 0, comment_count: 0, liked_by_me: false, profiles: profile }, ...prev]);
      setContent(''); setImageUrl(''); setShowImageInput(false); setComposing(false);
    }
    setPosting(false);
  };

  const deletePost = async (id: string) => {
    await supabase.from('posts').delete().eq('id', id);
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const toggleLike = async (post: Post) => {
    if (!profile) return;
    if (post.liked_by_me) {
      await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', profile.id);
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, like_count: (p.like_count ?? 0) - 1, liked_by_me: false } : p));
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: profile.id });
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, like_count: (p.like_count ?? 0) + 1, liked_by_me: true } : p));
    }
  };

  const loadComments = async (postId: string) => {
    const { data } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
    const comments = (data as Comment[]) ?? [];
    setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
    const authorIds = [...new Set(comments.map((c) => c.user_id))];
    await fetchProfiles(authorIds);
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId);
      else { next.add(postId); loadComments(postId); }
      return next;
    });
  };

  const submitComment = async (postId: string) => {
    if (isSlave) return;
    const text = commentInputs[postId]?.trim();
    if (!text || !profile) return;
    const { data } = await supabase.from('comments').insert({
      post_id: postId, user_id: profile.id, content: text,
    }).select('*').single();
    if (data) {
      setCommentsByPost((prev) => ({ ...prev, [postId]: [...(prev[postId] ?? []), { ...data as Comment, profiles: profile }] }));
      setCommentInputs((prev) => ({ ...prev, [postId]: '' }));
      setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p));
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="anime-card rounded-2xl p-5 mb-6">
        {isSlave ? (
          <div className="w-full flex items-center gap-3">
            <Avatar profile={profile} size={40} />
            <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 text-sm">
              <Lock className="w-4 h-4 shrink-0" /> Cấp bậc "Nô lệ" không được phép đăng bài.
            </div>
          </div>
        ) : !composing ? (
          <button onClick={() => setComposing(true)} className="w-full flex items-center gap-3 text-left">
            <Avatar profile={profile} size={40} />
            <div className="flex-1 px-4 py-3 rounded-xl bg-pink-100/50 dark:bg-white/5 text-slate-400 dark:text-fuchsia-200/40 text-sm hover:bg-pink-100 dark:hover:bg-white/10 transition-colors">
              Bạn muốn chia sẻ gì?
            </div>
          </button>
        ) : (
          <div className="space-y-3 animate-in fade-in">
            <div className="flex gap-3">
              <Avatar profile={profile} size={40} />
              <textarea
                autoFocus value={content} onChange={(e) => setContent(e.target.value)}
                placeholder="Viết gì đó..."
                rows={3}
                className="flex-1 px-4 py-3 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 resize-none transition-all"
              />
            </div>
            {showImageInput && (
              <div className="flex gap-2 animate-in fade-in">
                <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL hình ảnh..."
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/60 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm transition-all" />
                <button onClick={() => { setShowImageInput(false); setImageUrl(''); }} className="px-3 rounded-xl text-slate-400 hover:text-rose-400">
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            {imageUrl && (
              <img src={imageUrl} alt="" className="w-full max-h-64 object-cover rounded-xl border border-pink-200 dark:border-fuchsia-500/20" />
            )}
            <div className="flex items-center justify-between">
              <button onClick={() => setShowImageInput(!showImageInput)} className="flex items-center gap-2 text-pink-500 hover:text-pink-600 text-sm font-medium transition-colors">
                <ImagePlus className="w-5 h-5" /> Ảnh
              </button>
              <div className="flex items-center gap-2">
                <button onClick={() => { setComposing(false); setContent(''); setImageUrl(''); setShowImageInput(false); }}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-700 dark:hover:text-white text-sm font-medium transition-colors">
                  Hủy
                </button>
                <button onClick={submitPost} disabled={!content.trim() || posting}
                  className="px-5 py-2 rounded-xl anime-btn-primary text-sm font-semibold disabled:opacity-50 flex items-center gap-2">
                  {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Đăng
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
      ) : posts.length === 0 ? (
        <div className="anime-card rounded-2xl p-12 text-center">
          <Sparkles className="w-12 h-12 text-pink-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-fuchsia-200/60">Chưa có bài đăng nào. Hãy đăng bài đầu tiên!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => {
            const author = profileCache[post.user_id] ?? post.profiles;
            const colors = ROLE_COLORS[author?.role ?? 'Thành viên'];
            const isMine = post.user_id === profile?.id;
            return (
              <div key={post.id} className="anime-card rounded-2xl p-5 animate-in fade-in">
                <div className="flex items-start gap-3">
                  <Avatar profile={author} size={44} showBadge />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 dark:text-white">{author?.username ?? 'Unknown'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${colors.badge}`}>{author?.role ?? 'Thành viên'}</span>
                      <span className="text-xs text-slate-400">{new Date(post.created_at).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="text-slate-700 dark:text-fuchsia-100/80 mt-2 whitespace-pre-wrap">{post.content}</p>
                    {post.image_url && <img src={post.image_url} alt="" className="mt-3 w-full max-h-96 object-cover rounded-xl border border-pink-200/50 dark:border-fuchsia-500/20" />}
                  </div>
                  {isMine && (
                    <button onClick={() => deletePost(post.id)} className="text-slate-300 hover:text-rose-400 transition-colors p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-6 mt-4 pl-14">
                  <button onClick={() => toggleLike(post)} className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${post.liked_by_me ? 'text-pink-500' : 'text-slate-400 hover:text-pink-500'}`}>
                    <Heart className={`w-4 h-4 ${post.liked_by_me ? 'fill-pink-500' : ''}`} />
                    {post.like_count ?? 0}
                  </button>
                  <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-cyan-500 transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    {post.comment_count ?? 0}
                  </button>
                </div>

                {expandedComments.has(post.id) && (
                  <div className="mt-4 pl-14 space-y-3 animate-in fade-in">
                    {(commentsByPost[post.id] ?? []).map((c) => {
                      const cAuthor = profileCache[c.user_id];
                      const cColors = ROLE_COLORS[cAuthor?.role ?? 'Thành viên'];
                      return (
                        <div key={c.id} className="flex items-start gap-2.5">
                          <Avatar profile={cAuthor} size={28} />
                          <div className="flex-1">
                            <div className="bg-pink-100/50 dark:bg-white/5 rounded-xl px-3 py-2">
                              <span className={`text-xs font-medium ${cColors.text}`}>{cAuthor?.username ?? 'Unknown'}</span>
                              <p className="text-sm text-slate-700 dark:text-fuchsia-100/80">{c.content}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {isSlave ? (
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs text-slate-400">
                        <Lock className="w-3.5 h-3.5 shrink-0" /> Cấp bậc "Nô lệ" không được phép bình luận.
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Avatar profile={profile} size={28} />
                        <input
                          value={commentInputs[post.id] ?? ''}
                          onChange={(e) => setCommentInputs((prev) => ({ ...prev, [post.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && submitComment(post.id)}
                          placeholder="Viết bình luận..."
                          className="flex-1 px-3 py-2 rounded-xl bg-pink-100/50 dark:bg-white/5 border border-pink-200/50 dark:border-fuchsia-500/15 text-slate-800 dark:text-white placeholder-slate-400 outline-none focus:border-pink-500 text-sm transition-all"
                        />
                        <button onClick={() => submitComment(post.id)} className="text-pink-500 hover:text-pink-600 transition-colors">
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="anime-card rounded-2xl p-5 mt-6 flex items-start gap-3">
        <Info className="w-5 h-5 text-cyan-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-slate-600 dark:text-fuchsia-200/60 font-medium mb-1">Cấp bậc trong cộng đồng</p>
          <p className="text-xs text-slate-400">Nô lệ → Thành viên → Kiểm duyệt viên → Phó Admin → Admin → Sáng lập viên. Tích cực đăng bài & tương tác để được thăng cấp!</p>
        </div>
      </div>
    </div>
  );
}
