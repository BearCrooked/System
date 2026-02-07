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

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  // ======= 核心：onAuthStateChange 回调必须同步，不能 await =======
  useEffect(() => {
    mountedRef.current = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;

      // 只做同步的 state 更新，绝不 await
      setUser(session?.user ?? null);

      if (!session?.user) {
        setProfile(null);
      }

      if (_event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    });

    // 安全超时兜底
    const safetyTimeout = setTimeout(() => {
      if (mountedRef.current) setLoading(false);
    }, 5000);

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // ======= Profile 加载：独立 effect，带重试 =======
  const userIdRef = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;

    // 用户没变，不重新加载
    if (userId === userIdRef.current && profile) return;
    userIdRef.current = userId;

    if (!userId) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const load = async (attempt: number) => {
      if (cancelled) return;
      const result = await fetchProfile(userId);
      if (result || cancelled) return;

      // 失败后重试，最多 4 次，间隔递增
      if (attempt < 4) {
        const delay = attempt * 1500; // 1.5s, 3s, 4.5s
        retryTimer = setTimeout(() => load(attempt + 1), delay);
      }
    };

    // 首次加载延迟 100ms，让 token 刷新有时间完成
    retryTimer = setTimeout(() => load(1), 100);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
    };
  }, [user, profile, fetchProfile]);

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
