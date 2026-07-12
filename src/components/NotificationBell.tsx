import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { listAnnouncements } from '../lib/announcements';
import type { Announcement } from '../lib/types';
import { Bell, X, Megaphone } from 'lucide-react';

const STORAGE_PREFIX = 'anime_social_announcements_last_seen_';

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

export default function NotificationBell() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>('1970-01-01T00:00:00.000Z');
  const panelRef = useRef<HTMLDivElement>(null);

  const storageKey = profile ? `${STORAGE_PREFIX}${profile.id}` : null;

  useEffect(() => {
    if (!storageKey) return;
    const saved = localStorage.getItem(storageKey);
    if (saved) setLastSeen(saved);
  }, [storageKey]);

  // Tải danh sách thông báo + lắng nghe realtime để mọi người nhận thông báo mới ngay lập tức
  useEffect(() => {
    let active = true;
    listAnnouncements().then((data) => { if (active) setAnnouncements(data); }).catch(() => {});

    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements' }, (payload) => {
        const a = payload.new as Announcement;
        setAnnouncements((prev) => (prev.some((p) => p.id === a.id) ? prev : [a, ...prev]));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'announcements' }, (payload) => {
        const removedId = (payload.old as Announcement).id;
        setAnnouncements((prev) => prev.filter((p) => p.id !== removedId));
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  if (!profile) return null;

  const unreadCount = announcements.filter((a) => new Date(a.created_at) > new Date(lastSeen)).length;

  const togglePanel = () => {
    setOpen((v) => {
      const next = !v;
      if (next && storageKey) {
        const now = new Date().toISOString();
        localStorage.setItem(storageKey, now);
        setLastSeen(now);
      }
      return next;
    });
  };

  return (
    <div ref={panelRef} className="fixed top-16 right-4 lg:top-4 lg:right-4 z-[60] select-none">
      <button onClick={togglePanel} className="relative w-11 h-11 rounded-full anime-card flex items-center justify-center hover:scale-105 transition-transform" title="Thông báo">
        <Bell className="w-5 h-5 text-pink-500 dark:text-fuchsia-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] anime-card rounded-2xl p-4 shadow-2xl animate-in fade-in">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Megaphone className="w-3.5 h-3.5" /> Thông báo từ Admin
            </span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-rose-400"><X className="w-4 h-4" /></button>
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2">
            {announcements.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">Chưa có thông báo nào.</p>
            ) : announcements.map((a) => (
              <div key={a.id} className="p-3 rounded-xl bg-pink-50/60 dark:bg-white/5 border border-pink-200/50 dark:border-fuchsia-500/15">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white">{a.title}</p>
                  <span className="text-[10px] text-slate-400 shrink-0 whitespace-nowrap">{timeAgo(a.created_at)}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-fuchsia-100/70 mt-1 whitespace-pre-wrap">{a.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
