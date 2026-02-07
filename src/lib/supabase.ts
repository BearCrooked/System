import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * 将中文姓名转换为 email 安全格式
 * 用于 Supabase Auth（底层需要邮箱字段，用户无感知）
 */
export function nameToEmail(name: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(name.trim());
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `u${hex}@work.local`;
}
