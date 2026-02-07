-- ============================================
-- 员工工作量记录系统 - 数据库 Schema
-- 在 Supabase SQL Editor 中执行此文件
-- ============================================

-- 1. 用户信息表（扩展 auth.users）
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  employee_type TEXT NOT NULL DEFAULT 'regular' CHECK (employee_type IN ('intern', 'regular', 'manager')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 项目预设表
CREATE TABLE project_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_name TEXT UNIQUE NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_label TEXT NOT NULL DEFAULT '集',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 员工身份设置表
CREATE TABLE employee_type_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type_name TEXT UNIQUE NOT NULL CHECK (type_name IN ('intern', 'regular', 'manager')),
  type_label TEXT NOT NULL,
  daily_wage DECIMAL(10,2) NOT NULL DEFAULT 0,
  overtime_rate DECIMAL(10,2) NOT NULL DEFAULT 9,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 工作记录表
CREATE TABLE work_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  project_name TEXT NOT NULL,
  workload DECIMAL(10,2) NOT NULL DEFAULT 0,
  overtime DECIMAL(10,2) NOT NULL DEFAULT 0,
  unit_price_snapshot DECIMAL(10,2) NOT NULL DEFAULT 0,
  overtime_rate_snapshot DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 启用 RLS（行级安全）
-- ============================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_type_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS 策略
-- ============================================

-- profiles: 所有人可读，自己可插入，管理员可更新所有人
CREATE POLICY "profiles_select_all" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- work_records: 所有人可读，用户只能插入自己的，删除限当天自己的或管理员
CREATE POLICY "records_select_all" ON work_records
  FOR SELECT USING (true);

CREATE POLICY "records_insert_own" ON work_records
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "records_delete" ON work_records
  FOR DELETE USING (
    (auth.uid() = user_id AND record_date = CURRENT_DATE)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- project_presets: 所有人可读，管理员可增删改
CREATE POLICY "presets_select_all" ON project_presets
  FOR SELECT USING (true);

CREATE POLICY "presets_insert_admin" ON project_presets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "presets_update_admin" ON project_presets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "presets_delete_admin" ON project_presets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- employee_type_settings: 所有人可读，管理员可改
CREATE POLICY "ets_select_all" ON employee_type_settings
  FOR SELECT USING (true);

CREATE POLICY "ets_insert_admin" ON employee_type_settings
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "ets_update_admin" ON employee_type_settings
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "ets_delete_admin" ON employee_type_settings
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================
-- 触发器: 用户注册时自动创建 profile
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role, employee_type)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', 'unnamed'),
    'user',
    'regular'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 默认数据：项目预设
-- ============================================
INSERT INTO project_presets (project_name, unit_price, unit_label, sort_order) VALUES
  ('Ai漫生成', 30, '集', 1),
  ('Ai真人漫生成', 30, '集', 2),
  ('Ai漫剪辑', 80, '集', 3),
  ('Ai真人漫剪辑', 80, '集', 4),
  ('试标', 200, '次', 5),
  ('上班', 0, '天', 6),
  ('Ai漫学习', 200, '天', 7);

-- ============================================
-- 默认数据：员工身份设置
-- ============================================
INSERT INTO employee_type_settings (type_name, type_label, daily_wage, overtime_rate) VALUES
  ('intern', '实习', 0, 9),
  ('regular', '正式', 0, 9),
  ('manager', '管理', 0, 9);

-- ============================================
-- 索引优化
-- ============================================
CREATE INDEX idx_work_records_user_id ON work_records(user_id);
CREATE INDEX idx_work_records_record_date ON work_records(record_date);
CREATE INDEX idx_work_records_user_date ON work_records(user_id, record_date);
