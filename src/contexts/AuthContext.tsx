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
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (data) setProfile(data as Profile);
    return data as Profile | null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const login = async (name: string, password: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return { error: '请输入姓名' };
    if (!password) return { error: '请输入密码' };

    const email = nameToEmail(trimmedName);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { error: '用户名或密码错误' };
    // 确保登录后 profile 已加载
    if (data.user) {
      setUser(data.user);
      await fetchProfile(data.user.id);
    }
    return {};
  };

  const register = async (name: string, password: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return { error: '请输入姓名' };
    if (password.length < 6) return { error: '密码至少6位' };

    // 检查姓名是否已存在
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
    // 注册后自动登录，确保 profile 已加载
    if (data.user) {
      setUser(data.user);
      // 等待数据库触发器创建 profile
      await new Promise((r) => setTimeout(r, 500));
      await fetchProfile(data.user.id);
    }
    return {};
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
