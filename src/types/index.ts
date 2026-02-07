export interface Profile {
  id: string;
  name: string;
  role: 'user' | 'admin';
  employee_type: 'intern' | 'regular' | 'manager';
  created_at: string;
}

export interface WorkRecord {
  id: string;
  user_id: string;
  user_name: string;
  project_name: string;
  workload: number;
  overtime: number;
  unit_price_snapshot: number;
  overtime_rate_snapshot: number;
  notes: string;
  record_date: string;
  created_at: string;
}

export interface ProjectPreset {
  id: string;
  project_name: string;
  unit_price: number;
  unit_label: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface EmployeeTypeSetting {
  id: string;
  type_name: string;
  type_label: string;
  daily_wage: number;
  overtime_rate: number;
  created_at: string;
}

export const EMPLOYEE_TYPE_LABELS: Record<string, string> = {
  intern: '实习',
  regular: '正式',
  manager: '管理',
};

export const ROLE_LABELS: Record<string, string> = {
  user: '普通用户',
  admin: '管理员',
};
