import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_COLORS, isUserMuted, muteRemainingMinutes } from '../lib/roles';
import type { Profile, ChatMessage } from '../lib/types';
import Avatar from '../components/Avatar';
import { Send, Loader2, Hash, Users, ArrowLeft, Trash2, Search, AlertCircle, VolumeX } from 'lucide-react';

type Room = { type: 'global'; key: string } | { type: 'direct'; key: string; peer: Profile };

function dmRoomKey(a: string, b: string) { return [a, b].sort().join('__'); }

export default function ChatPage() {
  const { profile } = useAuth();
  const [room, setRoom] = useState<Room>({ type: 'global', key: 'global' });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState<Profile[]>([]);
  const [dmList, setDmList] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [error, setError] = useState('');
  const [profileCache, setProfileCache] = useState<Record<string, Profile>>({});
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Đồng hồ nội bộ: cứ 15s render lại một lần để trạng thái "đang bị cấm chat"
  // tự cập nhật (và tự gỡ) đúng thời điểm hết 60 phút, không cần thao tác gì thêm.
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, []);

  const muted = isUserMuted(profile?.muted_until);
  const muteMinutesLeft = muteRemainingMinutes(profile?.muted_until);

  const fetchProfiles = useCallback(async (ids: string[]) => {
    const missing = ids.filter((id) => !profileCache[id]);
    if (missing.length === 0) return;
    const { data } = await supabase.from('profiles').select('*').in('id', missing);
    if (data) setProfileCache((prev) => { const n = { ...prev }; (data as Profile[]).forEach((p) => { n[p.id] = p; }); return n; });
  }, [profileCache]);

  useEffect(() => {
    supabase.from('profiles').select('*').order('username').then(({ data }) => setMembers((data as Profile[]) ?? []));
  }, []);

  useEffect(() => {
    if (!profile) return;
    const loadDmPeers = async () => {
      const { data } = await supabase.from('chat_messages').select('sender_id, recipient_id').eq('room_type', 'direct').or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`);
      if (data) {
        const peerIds = new Set<string>();
        (data as any[]).forEach((m) => {
          if (m.sender_id === profile.id && m.recipient_id) peerIds.add(m.recipient_id);
          if (m.recipient_id === profile.id) peerIds.add(m.sender_id);
        });
        if (peerIds.size > 0) {
          const { data: peers } = await supabase.from('profiles').select('*').in('id', [...peerIds]);
          setDmList((peers as Profile[]) ?? []);
        }
      }
    };
    loadDmPeers();
  }, [profile]);

  const loadMessages = useCallback(async () => {
    if (!profile) return;
    setLoading(true); setError('');
    let query = supabase.from('chat_messages').select('*');
    if (room.type === 'global') {
      query = query.eq('room_type', 'global').order('created_at', { ascending: true }).limit(200);
    } else {
      const peerId = room.peer.id;
      query = query.eq('room_type', 'direct').or(`and(sender_id.eq.${profile.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${profile.id})`).order('created_at', { ascending: true }).limit(200);
    }
    const { data, error: err } = await query;
    if (err) { setError(err.message); setLoading(false); return; }
    const msgs = (data as ChatMessage[]) ?? [];
    setMessages(msgs);
    await fetchProfiles([...new Set(msgs.map((m) => m.sender_id))]);
    setLoading(false);
  }, [room, profile, fetchProfiles]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`chat-${room.key}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as ChatMessage;
        if (room.type === 'global' && msg.room_type === 'global') {
          fetchProfiles([msg.sender_id]).then(() => setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        } else if (room.type === 'direct' && msg.room_type === 'direct' && profile) {
          const peerId = room.peer.id;
          if ((msg.sender_id === profile.id && msg.recipient_id === peerId) || (msg.sender_id === peerId && msg.recipient_id === profile.id)) {
            fetchProfiles([msg.sender_id]).then(() => setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
          }
        }
      }).subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [room, profile, fetchProfiles]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !profile || sending || muted) return;
    setSending(true); setError('');
    const payload: any = { sender_id: profile.id, room_type: room.type, content: input.trim() };
    if (room.type === 'direct') payload.recipient_id = room.peer.id;
    const { data, error: err } = await supabase.from('chat_messages').insert(payload).select('*').single();
    if (err) { setError(err.message); setSending(false); return; }
    if (data) {
      setMessages((prev) => [...prev, data as ChatMessage]);
      setInput('');
      if (room.type === 'direct' && !dmList.find((p) => p.id === room.peer.id)) setDmList((prev) => [room.peer, ...prev]);
    }
    setSending(false);
  };

  const deleteMessage = async (id: string) => {
    await supabase.from('chat_messages').delete().eq('id', id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  };

  const filteredMembers = members.filter((m) => m.id !== profile?.id && m.username.toLowerCase().includes(search.toLowerCase()));
  const roomTitle = room.type === 'global' ? 'Cộng đồng' : room.peer.username;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex gap-4 h-[calc(100vh-8rem)]">
        <div className={`${mobileView === 'chat' ? 'hidden' : 'flex'} lg:flex flex-col w-full lg:w-72 shrink-0 anime-card rounded-2xl overflow-hidden`}>
          <div className="p-4 border-b border-pink-200/50 dark:border-fuchsia-500/20">
            <h2 className="font-bold anime-text-gradient text-lg mb-3">Đoạn chat</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm thành viên..." onFocus={() => setShowMembers(true)}
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/50 dark:bg-white/5 border border-pink-200 dark:border-fuchsia-500/20 text-slate-800 dark:text-white text-sm placeholder-slate-400 outline-none focus:border-pink-500 transition-all" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <button onClick={() => { setRoom({ type: 'global', key: 'global' }); setMobileView('chat'); setShowMembers(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${room.type === 'global' ? 'anime-btn-primary text-white' : 'text-slate-500 dark:text-fuchsia-200/60 hover:bg-pink-100/50 dark:hover:bg-white/5'}`}>
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-500 flex items-center justify-center shrink-0">
                <Hash className="w-5 h-5 text-white" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-medium text-sm truncate">Cộng đồng</p>
                <p className="text-xs opacity-70">Phòng chat chung</p>
              </div>
            </button>

            <div className="pt-2 pb-1 px-3"><span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tin nhắn</span></div>

            {dmList.map((peer) => (
              <button key={peer.id} onClick={() => { setRoom({ type: 'direct', key: dmRoomKey(profile!.id, peer.id), peer }); setMobileView('chat'); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${room.type === 'direct' && room.peer.id === peer.id ? 'anime-btn-primary text-white' : 'text-slate-500 dark:text-fuchsia-200/60 hover:bg-pink-100/50 dark:hover:bg-white/5'}`}>
                <Avatar profile={peer} size={36} />
                <span className="font-medium text-sm truncate">{peer.username}</span>
              </button>
            ))}

            {showMembers && search && (
              <>
                <div className="pt-2 pb-1 px-3"><span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Thành viên</span></div>
                {filteredMembers.length === 0 ? <p className="text-xs text-slate-400 px-3 py-2">Không tìm thấy</p> : filteredMembers.map((m) => (
                  <button key={m.id} onClick={() => { setRoom({ type: 'direct', key: dmRoomKey(profile!.id, m.id), peer: m }); setMobileView('chat'); setShowMembers(false); setSearch(''); }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 dark:text-fuchsia-200/60 hover:bg-pink-100/50 dark:hover:bg-white/5 transition-all">
                    <Avatar profile={m} size={36} />
                    <div className="text-left min-w-0">
                      <p className="font-medium text-sm truncate text-slate-800 dark:text-white">{m.username}</p>
                      <p className="text-xs opacity-60">{m.role}</p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {dmList.length === 0 && !search && (
              <div className="px-3 py-8 text-center">
                <Users className="w-8 h-8 text-pink-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">Tìm thành viên để bắt đầu chat</p>
              </div>
            )}
          </div>
        </div>

        <div className={`${mobileView === 'list' ? 'hidden' : 'flex'} lg:flex flex-1 flex-col anime-card rounded-2xl overflow-hidden`}>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-pink-200/50 dark:border-fuchsia-500/20">
            <button onClick={() => setMobileView('list')} className="lg:hidden text-slate-400 hover:text-pink-500"><ArrowLeft className="w-5 h-5" /></button>
            {room.type === 'global' ? (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-fuchsia-500 flex items-center justify-center anime-glow-pink">
                <Hash className="w-5 h-5 text-white" />
              </div>
            ) : <Avatar profile={room.peer} size={36} showBadge />}
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">{roomTitle}</h3>
              <p className="text-xs text-slate-400">{room.type === 'global' ? 'Phòng chat cộng đồng' : `Chat riêng với ${room.peer.username}`}</p>
            </div>
          </div>

          {error && (
            <div className="mx-4 mt-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" /><span className="truncate">{error}</span>
              <button onClick={() => setError('')} className="ml-auto text-rose-400 hover:text-rose-600">×</button>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-pink-500" /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-10"><p className="text-slate-400 text-sm">Chưa có tin nhắn. Hãy nói lời chào!</p></div>
            ) : messages.map((msg) => {
              const isMe = msg.sender_id === profile?.id;
              const sender = profileCache[msg.sender_id];
              const colors = ROLE_COLORS[sender?.role ?? 'Thành viên'];
              return (
                <div key={msg.id} className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <Avatar profile={sender ?? null} size={32} />
                  <div className={`max-w-[75%] group ${isMe ? 'text-right' : ''}`}>
                    <div className="flex items-center gap-2 mb-0.5">
                      {!isMe && <span className={`text-xs font-medium ${colors.text}`}>{sender?.username ?? 'Unknown'}</span>}
                      <span className="text-xs text-slate-400">{new Date(msg.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className={`inline-block px-3.5 py-2 rounded-2xl text-sm ${isMe ? 'anime-btn-primary text-white rounded-tr-md' : 'bg-pink-100/60 dark:bg-white/5 text-slate-700 dark:text-fuchsia-100/80 rounded-tl-md'}`}>
                      {msg.content}
                    </div>
                    {isMe && <button onClick={() => deleteMessage(msg.id)} className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 text-slate-400 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-pink-200/50 dark:border-fuchsia-500/20">
            {muted && (
              <div className="mb-2.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-4 py-2.5 text-rose-600 dark:text-rose-400 text-sm flex items-center gap-2">
                <VolumeX className="w-4 h-4 shrink-0" />
                Bạn đang bị cấm chat, còn {muteMinutesLeft} phút nữa sẽ được gỡ tự động.
              </div>
            )}
            <div className={`flex items-center gap-2 bg-pink-100/50 dark:bg-white/5 rounded-xl px-4 py-2.5 border border-pink-200/50 dark:border-fuchsia-500/15 ${muted ? 'opacity-60' : ''}`}>
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                disabled={muted}
                placeholder={muted ? 'Bạn đang bị cấm chat...' : 'Nhập tin nhắn...'}
                className="flex-1 bg-transparent text-slate-800 dark:text-white placeholder-slate-400 outline-none text-sm disabled:cursor-not-allowed" />
              <button onClick={sendMessage} disabled={!input.trim() || sending || muted} className="text-pink-500 hover:text-pink-600 disabled:opacity-30 transition-colors">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
