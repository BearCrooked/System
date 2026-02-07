import { useEffect, useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spin } from 'antd';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({
  children,
  requireAdmin = false,
}: ProtectedRouteProps) {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [retried, setRetried] = useState(false);

  // 如果有 user 但 profile 为 null，自动重试获取 profile
  const retry = useCallback(async () => {
    if (user && !profile && !loading && !retried) {
      setRetried(true);
      await refreshProfile();
    }
  }, [user, profile, loading, retried, refreshProfile]);

  useEffect(() => {
    retry();
  }, [retry]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // 有 user 但 profile 还没加载到，等待重试
  if (user && !profile && !retried) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="正在加载用户信息..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // user 存在但 profile 获取失败（重试后仍为 null），仍然允许进入
  // 页面组件会各自处理 profile 为 null 的情况
  if (requireAdmin && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
