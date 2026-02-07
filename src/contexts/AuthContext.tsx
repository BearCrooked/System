import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
  const mountedRef = useRef(true);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
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
      if (data && mountedRef.current) {
        setProfile(data as Profile);
      }
      return data as Profile | null;
    } catch (err) {
      console.error('fetchProfile 网络错误:', err);
      return null;
    }
  }, []);

  const fetchProfileWithRetry = useCallback(
    async (userId: string) => {
      let attempts = 0;
      while (attempts < 3) {
        const result = await fetchProfile(userId);
        if (result) return result;

        // 尝试刷新 session 后重试
        try {
          await supabase.auth.refreshSession();
        } catch (err) {
          console.error('刷新 session 失败:', err);
        }

        attempts += 1;
        await new Promise((r) => setTimeout(r, attempts * 500));
      }
      return null;
    },
    [fetchProfile]
  );

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfileWithRetry(user.id);
    }
  }, [user, fetchProfileWithRetry]);

  // ======= 初始化：先 getSession 再订阅事件 =======
  useEffect(() => {
    mountedRef.current = true;

    let cancelled = false;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled || !mountedRef.current) return;
        if (error) {
          console.error('获取 session 失败:', error.message);
        }
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          await fetchProfileWithRetry(currentUser.id);
        } else {
          setProfile(null);
        }
      } catch (err) {
        console.error('初始化 session 失败:', err);
      } finally {
        if (!cancelled && mountedRef.current) {
          setLoading(false);
        }
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;

      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        return;
      }

      // 不在回调里 await，异步刷新 profile
      setTimeout(() => {
        if (mountedRef.current && session?.user) {
          void fetchProfileWithRetry(session.user.id);
        }
      }, 0);
    });

    return () => {
      mountedRef.current = false;
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [fetchProfileWithRetry]);

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
