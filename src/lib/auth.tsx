import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import type { Profile } from './types';

const AuthContext = createContext<{
  session: any | null;
  profile: Profile | null;
  loading: boolean;
  banNotice: string;
  clearBanNotice: () => void;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}>({
  session: null,
  profile: null,
  loading: true,
  banNotice: '',
  clearBanNotice: () => {},
  refreshProfile: async () => {},
  signOut: async () => {},
});

const BAN_MESSAGE = 'Tài khoản của bạn đã bị khoá vĩnh viễn. Vui lòng liên hệ quản trị viên nếu có thắc mắc.';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [banNotice, setBanNotice] = useState('');

  const clearBanNotice = () => setBanNotice('');

  const refreshProfile = async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();
    const p = data as Profile | null;

    if (p?.is_banned) {
      setBanNotice(BAN_MESSAGE);
      setProfile(null);
      await supabase.auth.signOut();
      return;
    }

    setProfile(p);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (!session) setProfile(null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      refreshProfile();
    } else {
      setProfile(null);
    }
  }, [session]);

  // Lắng nghe realtime thay đổi trên hồ sơ của chính mình (đổi role, bị mute,
  // BỊ CẤM VĨNH VIỄN...) để cập nhật/xử lý ngay lập tức, không cần tải lại trang.
  useEffect(() => {
    if (!session?.user?.id) return;
    const channel = supabase
      .channel(`own-profile-${session.user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        async (payload) => {
          const p = payload.new as Profile;
          if (p.is_banned) {
            setBanNotice(BAN_MESSAGE);
            setProfile(null);
            await supabase.auth.signOut();
            return;
          }
          setProfile(p);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.user?.id]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, banNotice, clearBanNotice, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
