import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { ROLE_COLORS, ROLE_RANK, ALL_ROLES } from '../lib/roles';
import type { Profile } from '../lib/types';
import Avatar from '../components/Avatar';
import { Search, Users } from 'lucide-react';

export default function MembersPage() {
  const { profile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: true }).then(({ data }) => {
      setMembers((data as Profile[]) ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = members.filter((m) => m.username.toLowerCase().includes(search.toLowerCase()));
  const sorted = [...filtered].sort((a, b) => ROLE_RANK[b.role] - ROLE_RANK[a.role]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl anime-btn-primary flex items-center justify-center anime-glow-pink">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold anime-text-gradient">Thành viên</h1>
          <p className="text-slate-400 text-sm">{members.length} thành viên trong cộng đồng</p>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-pink-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm thành viên..."
          className="w-full pl-12 pr-4 py-3 rounded-xl anime-card text-slate-800 dark:text-white placeholder-slate-400 focus:border-pink-500 outline-none transition-all" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => <div key={i} className="anime-card rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="anime-card rounded-2xl p-12 text-center">
          <Users className="w-12 h-12 text-pink-300 mx-auto mb-4" />
          <p className="text-slate-400">Không tìm thấy thành viên</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {sorted.map((m) => {
            const colors = ROLE_COLORS[m.role];
            const isMe = m.id === profile?.id;
            return (
              <div key={m.id} className="anime-card rounded-2xl p-4 flex items-center gap-3 hover:scale-[1.02] transition-transform">
                <Avatar profile={m} size={48} showBadge />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800 dark:text-white truncate">{m.username}</span>
                    {isMe && <span className="text-xs text-pink-500 font-medium">(Bạn)</span>}
                  </div>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full ${colors.badge} mt-1`}>{m.role}</span>
                  {m.bio && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{m.bio}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="anime-card rounded-2xl p-5 mt-6">
        <h3 className="font-bold anime-text-gradient mb-4">Hệ thống cấp bậc</h3>
        <div className="space-y-2">
          {ALL_ROLES.slice().reverse().map((role, i) => {
            const colors = ROLE_COLORS[role];
            const count = members.filter((m) => m.role === role).length;
            return (
              <div key={role} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full ${colors.bg} flex items-center justify-center text-xs font-bold ${colors.text}`}>{ALL_ROLES.length - i}</div>
                <span className={`font-medium ${colors.text} flex-1`}>{role}</span>
                <span className="text-sm text-slate-400">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
