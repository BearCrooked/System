import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { supabase, nameToEmail } from '../lib/supabase';
import type { Profile } from '../types';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  login: (name: string, password: string) => Promise<{ error?: string }>;
  register: (name: string, password: string) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (error) {
        console.error('获取用户信息失败:', error.message);
        return null;
      }
      if (data) setProfile(data as Profile);
      return data as Profile | null;
    } catch (err) {
      console.error('网络错误:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    let mounted = true;

    // 超时保护：最多 8 秒必须结束 loading
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('认证初始化超时，强制结束 loading');
        setLoading(false);
      }
    }, 8000);

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          console.error('获取会话失败:', error.message);
          setLoading(false);
          return;
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          // 用 Promise.race 限制 fetchProfile 最多等 5 秒
          await Promise.race([
            fetchProfile(currentUser.id),
            new Promise((resolve) => setTimeout(resolve, 5000)),
          ]);
        }
      } catch (err) {
        console.error('初始化认证失败:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        if (event !== 'TOKEN_REFRESHED') {
          await fetchProfile(currentUser.id);
        }
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const login = async (name: string, password: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return { error: '请输入姓名' };
    if (!password) return { error: '请输入密码' };

    try {
      const email = nameToEmail(trimmedName);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { error: '用户名或密码错误' };
      if (data.user) {
        setUser(data.user);
        await fetchProfile(data.user.id);
      }
      return {};
    } catch {
      return { error: '网络错误，请检查网络连接' };
    }
  };

  const register = async (name: string, password: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return { error: '请输入姓名' };
    if (password.length < 6) return { error: '密码至少6位' };

    try {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('name', trimmedName)
        .maybeSingle();

      if (existing) return { error: '该姓名已被注册，请使用其他姓名' };

      const email = nameToEmail(trimmedName);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: trimmedName },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          return { error: '该姓名已被注册' };
        }
        return { error: error.message };
      }
      if (data.user) {
        setUser(data.user);
        await new Promise((r) => setTimeout(r, 500));
        await fetchProfile(data.user.id);
      }
      return {};
    } catch {
      return { error: '网络错误，请检查网络连接' };
    }
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // 即使签出失败也清除本地状态
    }
    setProfile(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, login, register, logout, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
