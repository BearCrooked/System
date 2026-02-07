-- ============================================
-- 修复 Admin RLS 权限问题 + 移除 CHECK 约束
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================

-- 0. 移除限制 type_name 和 employee_type 的 CHECK 约束（允许自定义身份）
ALTER TABLE employee_type_settings DROP CONSTRAINT IF EXISTS employee_type_settings_type_name_check;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_employee_type_check;

-- 1. 创建 is_admin() 辅助函数（绕过 RLS 递归）
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. 删除旧的 RLS 策略
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "records_delete" ON work_records;
DROP POLICY IF EXISTS "presets_insert_admin" ON project_presets;
DROP POLICY IF EXISTS "presets_update_admin" ON project_presets;
DROP POLICY IF EXISTS "presets_delete_admin" ON project_presets;
DROP POLICY IF EXISTS "ets_insert_admin" ON employee_type_settings;
DROP POLICY IF EXISTS "ets_update_admin" ON employee_type_settings;
DROP POLICY IF EXISTS "ets_delete_admin" ON employee_type_settings;

-- 3. 重新创建使用 is_admin() 的策略
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.is_admin()
  );

CREATE POLICY "records_delete" ON work_records
  FOR DELETE USING (
    public.is_admin() AND user_id <> auth.uid()
  );

CREATE POLICY "presets_insert_admin" ON project_presets
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "presets_update_admin" ON project_presets
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "presets_delete_admin" ON project_presets
  FOR DELETE USING (public.is_admin());

CREATE POLICY "ets_insert_admin" ON employee_type_settings
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "ets_update_admin" ON employee_type_settings
  FOR UPDATE USING (public.is_admin());

CREATE POLICY "ets_delete_admin" ON employee_type_settings
  FOR DELETE USING (public.is_admin());
