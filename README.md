# 员工工作量记录系统

基于 React + Supabase 的员工工作量记录与薪资计算 Web 应用。

## 功能特点

- **用户端**: 登录注册、工作记录添加（支持批量）、查看个人数据、查看其他用户数据、导出 Excel
- **管理员端**: 用户管理（角色/身份）、查看所有用户记录、批量删除（密码验证）、薪资计算、全员薪资导出、项目预设管理、员工身份设置

## 技术栈

- **前端**: React 19 + TypeScript + Vite + Ant Design
- **后端**: Supabase (PostgreSQL + Auth + RLS)
- **导出**: SheetJS (xlsx)
- **部署**: Vercel

## 快速开始

### 1. 配置 Supabase

1. 前往 [supabase.com](https://supabase.com) 创建免费项目
2. 在 **SQL Editor** 中执行 `supabase/schema.sql` 文件的全部内容
3. 在 **Authentication > Providers > Email** 中：
   - 关闭 **Confirm email**（取消邮箱验证）
   - 开启 **Enable Email Signup**

### 2. 配置环境变量

复制环境变量模板并填入 Supabase 凭据：

```bash
copy .env.example .env.local
```

编辑 `.env.local`：

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

> 在 Supabase 项目的 **Settings > API** 中可以找到这两个值。

### 3. 安装与运行

```bash
npm install
npm run dev
```

访问 http://localhost:5173

### 4. 设置管理员

注册第一个账号后，在 Supabase SQL Editor 中执行：

```sql
UPDATE profiles SET role = 'admin' WHERE name = '你的姓名';
```

之后该账号即拥有管理员权限，可在管理面板中设置其他用户的角色。

## 项目预设默认值

| 项目名称 | 单价 | 单位 |
|---------|------|------|
| Ai漫生成 | 30元 | 集 |
| Ai真人漫生成 | 30元 | 集 |
| Ai漫剪辑 | 80元 | 集 |
| Ai真人漫剪辑 | 80元 | 集 |
| 试标 | 200元 | 次 |
| 上班 | 按身份日薪 | 天 |
| Ai漫学习 | 200元 | 天 |

## 薪资计算公式

- **普通项目**: `单价 × 工作量 + 加班时间 × 加班费率`
- **上班项目**: `身份日薪 × 天数 + 加班时间 × 加班费率`
- **月薪**: 当月所有记录薪资之和

## 部署到 Vercel

1. 将代码推送到 GitHub 仓库
2. 在 [vercel.com](https://vercel.com) 导入该仓库
3. 在 Vercel 项目设置中添加环境变量：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 部署完成
